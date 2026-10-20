const assert = require("node:assert/strict");
const { test } = require("node:test");
const timers = require("node:timers/promises");
const { createHttpHarness } = require("./helpers/http.js");
const HoyoLab = require("../hoyolab-modules/template.js");
const { buildMimoRequest } = require("../hoyolab-modules/mimo-request.js");

const cookie = "ltoken_v2=synthetic; ltuid_v2=123; ltmid_v2=mid; cookie_token_v2=cookie; account_id_v2=123; account_mid_v2=mid";
const account = { cookie: `${cookie}; unrelated=ignored`, uid: "role", redeemCode: true };
const ok = (data = {}) => ({ body: { retcode: 0, data } });
const setup = async (t, gameId = 6, language) => {
	const harness = await createHttpHarness(t, { language });
	for (const name of ["log", "info", "warn"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.HoyoLab = { parseCookie: HoyoLab.parseCookie, errorMessage: () => null };
	app.Date = { now: () => Date.now() };
	const cache = new Map();
	app.Cache = { get: async key => cache.get(key), set: async ({ key, value }) => cache.set(key, value) };
	const delays = [];
	t.mock.method(timers, "setTimeout", async ms => delays.push(ms));
	const path = require.resolve("../hoyolab-modules/mimo.js");
	delete require.cache[path];
	t.after(() => {
		delete require.cache[path];
	});
	const redeemed = [];
	const instance = { gameId,
		name: gameId === 6 ? "starrail" : "zenless",
		fullName: "Synthetic Game",
		config: { assets: {} },
		redeemCode: async (data, code) => {
			redeemed.push(code);
			return { success: true };
		} };
	return { ...harness, delays, redeemed, mimo: new (require(path))(instance) };
};

for (const gameId of [6, 8]) {
	for (const language of [undefined, "it-it"]) {
		test(`Mimo operation wire contracts game ${gameId}, locale ${language}`, async t => {
			const { mimo, replies, requests } = await setup(t, gameId, language);
			replies.push(ok({ list: [{ game_id: gameId, version_id: 999, point: 25 }]}), ok({ task_list: []}), ok(), ok(), ok({ exchange_award_list: []}), ...(language ? [ok({ exchange_award_list: []})] : []), ok({ exchange_code: "synthetic-code" }), ok({ point: 25, cost: 20, count: 0, limit_count: 1, award_list: []}), ok({ name: "Points x5", exchange_code: "", award_id: 7 }), ok({ list: [], total_count: 0 }));
			assert.equal((await mimo.getGameInfo(account)).data.versionId, 999);
			await mimo.getTasks(account, 999);
			await mimo.finishTask(account, 88, 999);
			await mimo.claimTaskReward(account, 88, 999);
			await mimo.getShopItems(account, 999);
			assert.deepEqual(await mimo.exchangeItem(account, 77, 999), { success: true, data: { code: "synthetic-code" } });
			await mimo.getLotteryInfo(account, 999);
			assert.deepEqual((await mimo.drawLottery(account, 999)).data, { name: "Points x5", code: "", rewardId: 7, type: undefined });
			await mimo.getShopPurchases(account, 999);
			// Non-English shop reads retain the upstream English policy-name lookup.
			if (language) {
				assert.equal(requests[5].url.searchParams.get("lang"), "en-us");
				requests.splice(5, 1);
			}
			const paths = ["index", "task-list", "finish-task", "receive-point", "exchange-list", "exchange", "lottery-info", "lottery", "point-record"];
			for (const [i, request] of requests.entries()) {
				const post = [2, 5, 7].includes(i);
				const lang = i === 8 ? "en-us" : language || "en-us";
				assert.equal(request.url.origin, "https://sg-public-api.hoyolab.com");
				assert.equal(request.url.pathname, `/event/e2023mimotravel/${paths[i]}`);
				assert.equal(request.method, post ? "POST" : "GET");
				const fields = { game_id: gameId,
					version_id: 999,
					...([2, 3].includes(i) ? { task_id: 88 } : {}),
					...(i === 5 ? { award_id: 77 } : {}) };
				assert.deepEqual(Object.fromEntries(request.url.searchParams), {
					lang,
					...(!post && i !== 0 ? Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)])) : {}),
					...(i === 8 ? { operator_type: "2", page: "1", page_size: "100" } : {})
				});
				assert.deepEqual(request.body && JSON.parse(request.body), post ? { ...fields, lang } : undefined);
				assert.equal(request.headers.cookie, cookie);
				assert.match(request.headers["user-agent"], i < 4 ? /Android.*wv/ : /Windows NT/);
				assert.equal(request.headers["x-requested-with"], i < 4 ? "com.mihoyo.hoyolab" : undefined);
				for (const name of ["ds", "x-rpc-client_type", "x-rpc-app_version", "x-rpc-language", "x-rpc-platform", "x-rpc-device_id", "x-rpc-device_fp", "x-rpc-lrsag"]) {
					assert.equal(request.headers[name], undefined);
				}
			}
		});
	}
}

test("qiuqiu keeps underscore routes and its distinct POST locale contract", async t => {
	const { Got, requests } = await setup(t, 2, "it-it");
	for (const endpoint of ["finish-task", "receive-point", "exchange"]) {
		const request = buildMimoRequest(2, endpoint, { method: "POST", data: { game_id: 2, version_id: 99, lang: "it-it" }, cookie });
		await Got(request.profile, request.options);
		assert.equal(requests.at(-1).url.pathname.endsWith(endpoint.replace(/-/g, "_")), true);
		assert.equal(requests.at(-1).url.search, "?lang=it-it");
		assert.deepEqual(JSON.parse(requests.at(-1).body), { game_id: 2, version_id: 99 });
	}
});

test("latent qiuqiu lottery preserves legacy defaults without registering a profile", async t => {
	const { Got, requests } = await setup(t, 2, "it-it");
	for (const endpoint of ["lottery-info", "lottery"]) {
		const method = endpoint === "lottery" ? "POST" : "GET";
		const payload = { game_id: 2, version_id: 99, lang: "it-it" };
		const request = buildMimoRequest(2, endpoint, { method, params: payload, data: method === "POST" ? payload : null, cookie });
		await Got(request.profile, request.options);
		const actual = requests.at(-1);
		assert.equal(actual.headers["x-rpc-app_version"], "1.5.0");
		assert.equal(actual.headers["x-rpc-client_type"], 5);
		assert.equal(actual.headers["x-rpc-language"], "it-it");
		assert.equal(actual.headers.origin, undefined);
		assert.equal(actual.headers.referer, "https://act.hoyolab.com");
		assert.equal(actual.url.search, method === "POST" ? "" : "?game_id=2&version_id=99&lang=it-it");
	}
});

test("rate-limit retries retain backoff and stop after ten attempts", async t => {
	const { mimo, replies, requests, delays } = await setup(t);
	t.mock.method(Math, "random", () => 0);
	replies.push(...Array.from({ length: 10 }, () => ({ statusCode: 429, body: { retcode: -500004 } })));
	assert.equal((await mimo.finishTask(account, 1, 99)).success, false);
	assert.equal(requests.length, 10);
	assert.deepEqual(delays, new Array(9).fill(500));
});

const emptyShop = { success: true, data: []};
const flow = (mimo, points = 25) => {
	mimo.getGameInfo = async () => ({ success: true, data: { versionId: 999, points } });
	mimo.getTasks = async () => ({ success: true, data: []});
	mimo.getShopItems = async () => emptyShop;
};

test("run keeps task whitelist, claims completed tasks and leaves lottery disabled by default", async t => {
	const { mimo, requests, delays } = await setup(t);
	flow(mimo);
	mimo.getTasks = async () => ({ success: true,
		data: [
			...[1, 2, 4, 10, 101, 102].map(taskType => ({ id: taskType, taskType, status: 2, name: `Task ${taskType}`, point: 5 })),
			{ id: 200, taskType: 101, status: 1, name: "Completed timed task", point: 5 }
		]});
	const finished = [];
	const claimed = [];
	mimo.finishTask = async (data, id) => {
		finished.push(id);
		return { success: true };
	};
	mimo.claimTaskReward = async (data, id) => {
		claimed.push(id);
		return { success: true };
	};
	mimo.getLotteryInfo = async () => {
		throw new Error("Lottery must remain opt-in");
	};
	const result = await mimo.run(account);
	assert.equal(result.success, true);
	assert.deepEqual(finished, [1, 2]);
	assert.deepEqual(claimed, [1, 2, 200]);
	assert.deepEqual(delays, new Array(5).fill(1000));
	assert.equal(requests.length, 0);
});

for (const [points, reservePoints, expectedDraws] of [[19, 0, 0], [25, 10, 0], [25, 0, 1]]) {
	test(`lottery respects balance ${points}, reserve ${reservePoints} and point prizes`, async t => {
		const { mimo } = await setup(t);
		flow(mimo, points);
		mimo.getLotteryInfo = async () => ({ success: true, data: { cost: 20, currentCount: 0, limitCount: 1 } });
		let draws = 0;
		mimo.drawLottery = async () => {
			draws++;
			return { success: true, data: { name: "Points x5" } };
		};
		const result = await mimo.run({ ...account, mimo: { lottery: true, reservePoints } });
		assert.equal(draws, expectedDraws);
		assert.equal(result.data.lotteryDraws.length, expectedDraws);
	});
}

for (const redeem of [false, true]) {
	test(`exchange retains code output and redemption preference ${redeem}`, async t => {
		const { mimo, redeemed } = await setup(t);
		flow(mimo);
		mimo.getShopItems = async () => ({ success: true, data: [{ id: 7, name: "Stellar Jade", cost: 25, status: 1 }]});
		mimo.exchangeItem = async () => ({ success: true, data: { code: "synthetic-code" } });
		const result = await mimo.run({ ...account, mimo: { redeem } });
		assert.equal(result.data.itemsExchanged.length, 1);
		assert.deepEqual(redeemed, redeem ? ["synthetic-code"] : []);
		assert.deepEqual(result.data.codesObtained, redeem ? [] : ["synthetic-code"]);
	});
}

test("failed draw stops lottery and failed exchange does not emit a code", async t => {
	const { mimo, redeemed } = await setup(t);
	flow(mimo, 100);
	mimo.getShopItems = async () => ({ success: true, data: [{ id: 7, name: "Stellar Jade", cost: 25, status: 1 }]});
	mimo.exchangeItem = async () => ({ success: false });
	mimo.getLotteryInfo = async () => ({ success: true, data: { cost: 20, currentCount: 0, limitCount: 5 } });
	let draws = 0;
	mimo.drawLottery = async () => {
		draws++;
		return { success: false };
	};
	const result = await mimo.run({ ...account, mimo: { lottery: true } });
	assert.equal(draws, 1);
	assert.deepEqual(redeemed, []);
	assert.deepEqual(result.data.itemsExchanged, []);
	assert.deepEqual(result.data.lotteryDraws, []);
});

test("upstream shop policy reserves unavailable guaranteed rewards and saves its plan", async t => {
	const { mimo } = await setup(t);
	flow(mimo, 25);
	mimo.getShopItems = async () => ({ success: true, data: [{ id: 7, name: "Stellar Jade", cost: 25, status: 2, stock: 0 }]});
	mimo.getShopPurchases = async () => ({ success: true, data: []});
	mimo.getLotteryInfo = async () => ({ success: true, data: { cost: 20, currentCount: 0, limitCount: 1 } });
	mimo.drawLottery = async () => {
		throw new Error("Guaranteed reward points must be reserved");
	};
	const writes = [];
	app.Cache.set = async entry => writes.push(entry);
	const result = await mimo.run({ ...account, mimo: { lottery: true, shopPolicy: [{ category: "premiumCurrency", mode: "always" }]} });
	assert.equal(result.success, true);
	assert.equal(result.data.lotteryDraws.length, 0);
	assert.ok(writes.length > 0);
});
