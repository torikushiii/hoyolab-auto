const assert = require("node:assert/strict");
const { test } = require("node:test");
const timers = require("node:timers/promises");
const { createHttpHarness } = require("./helpers/http.js");
const HoyoLab = require("../hoyolab-modules/template.js");
const Genshin = require("../hoyolab-modules/genshin/index.js");
const { REDEMPTION_URL } = require("../hoyolab-modules/genshin/redemption-request.js");

const cookie = "ltoken_v2=synthetic-token; ltmid_v2=synthetic-mid; ltuid_v2=synthetic-id; cookie_token_v2=synthetic-cookie; account_mid_v2=synthetic-account-mid; account_id_v2=synthetic-account-id";
const account = { uid: "synthetic-role", region: "os_euro", cookie: `${cookie}; unrelated=synthetic`, redeemCode: true };
const ok = (data = {}) => ({ body: { retcode: 0, data } });
const info = (point = 20) => ok({ act_list: [{ act_info: { game_id: 2, version_id: 999, point } }]});
const task = (task_id, task_type, status = 2) => ({ task_id, task_type, status, task_name: `Synthetic task ${task_id}`, point: 5 });
const shop = (items = []) => ok({ exchange_award_list: items });

const setup = async (t, language) => {
	const harness = await createHttpHarness(t, { language });
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.HoyoLab = { parseCookie: HoyoLab.parseCookie };
	const delays = [];
	t.mock.method(timers, "setTimeout", async (ms) => delays.push(ms));
	const path = require.resolve("../hoyolab-modules/hilichurl.js");
	delete require.cache[path];
	t.after(() => {
		delete require.cache[path];
	});
	const Workshop = require(path);
	const instance = { fullName: "Genshin Impact", config: { assets: {}, url: { redemption: REDEMPTION_URL } } };
	instance.redeemCode = (data, code) => Genshin.prototype.redeemCode.call(instance, data, code);
	return { ...harness, delays, workshop: new Workshop(instance) };
};

for (const language of [undefined, "it-it"]) {
	test(`event GET and POST contracts (${language ?? "default"})`, async (t) => {
		const { workshop, replies, requests } = await setup(t, language);
		replies.push(info(), ok({ task_list: []}), shop(), ok(), ok(), ok({ exchange_code: "", type: 2, award_id: 77 }));
		await workshop.getGameInfo(account);
		await workshop.getTasks(account, 999);
		await workshop.getShopItems(account, 999);
		assert.deepEqual(await workshop.finishTask(account, 88, 999), { success: true });
		assert.deepEqual(await workshop.claimTaskReward(account, 88, 999), { success: true });
		assert.deepEqual(await workshop.exchangeItem(account, 77, 999), { success: true, data: { code: "", type: 2, awardId: 77 } });
		assert.equal(requests.length, 6);
		const paths = ["index", "task_list", "exchange_list", "finish_task", "receive_point", "exchange"];
		for (const [i, request] of requests.entries()) {
			assert.equal(request.url.origin, "https://sg-public-api.hoyolab.com");
			assert.equal(request.url.pathname, `/event/e2023mimotravel/qiuqiu/${paths[i]}`);
			assert.equal(request.method, i < 3 ? "GET" : "POST");
			assert.deepEqual(Object.fromEntries(request.url.searchParams), {
				lang: language ?? "en-us", ...(i === 1 || i === 2 ? { game_id: "2", version_id: "999" } : {})
			});
			assert.deepEqual(request.body && JSON.parse(request.body), i < 3
				? undefined
				: {
					[i === 5 ? "award_id" : "task_id"]: i === 5 ? 77 : 88, game_id: 2, version_id: 999
				});
			assert.equal(request.headers.cookie, cookie);
			assert.equal(request.headers.origin, "https://act.hoyolab.com");
			assert.equal(request.headers.referer, "https://act.hoyolab.com/");
			assert.equal(request.headers.accept, "application/json, text/plain, */*");
			assert.match(request.headers["user-agent"], /Android.*wv.*miHoYoBBSOversea\/4\.20\.0/);
			assert.equal(request.headers["x-requested-with"], "com.mihoyo.hoyolab");
			assert.equal(request.headers["x-rpc-client_type"], 2);
			assert.equal(request.headers["x-rpc-language"], language ?? "en-us");
			assert.equal(request.headers.ds, undefined);
			assert.deepEqual(Object.keys(request.headers).filter(key => key.startsWith("x-rpc-")).sort(), ["x-rpc-client_type", "x-rpc-language"]);
		}
	});
}

test("native ongoing tasks are reported, completed tasks of any type are claimed", async (t) => {
	const { workshop, replies, requests, logs, delays } = await setup(t);
	replies.push(info(), ok({ task_list: [task(1, 101), task(2, 102), task(3, 101, 1), task(4, 102, 1), task(5, 1), task(6, 2), task(7, 999), task(8, 1, 3)]}), ok(), ok(), ok(), ok(), ok(), ok(), info(40), shop());
	const result = await workshop.run(account);
	assert.equal(result.success, true);
	assert.deepEqual(result.data.tasksFinished, ["Synthetic task 5", "Synthetic task 6"]);
	assert.deepEqual(result.data.tasksClaimed.map(item => item.name), [3, 4, 5, 6].map(id => `Synthetic task ${id}`));
	assert.equal(result.data.points, 40);
	assert.deepEqual(requests.filter(r => r.method === "POST").map(r => [r.url.pathname.split("/").pop(), JSON.parse(r.body).task_id]), [
		["receive_point", 3], ["receive_point", 4], ["finish_task", 5], ["receive_point", 5], ["finish_task", 6], ["receive_point", 6]
	]);
	assert.equal(logs.filter(args => String(args[1]).includes("Automatic completion is unsupported")).length, 2);
	assert.deepEqual(delays, new Array(6).fill(1000));
});

for (const failure of [{ body: { retcode: -500004 } }, { statusCode: 429 }, { body: "Too Many Requests" }]) {
	test(`rate limit retry preserves request and jitter (${JSON.stringify(failure)})`, async (t) => {
		const { workshop, replies, requests, delays } = await setup(t);
		t.mock.method(Math, "random", () => 0.5);
		replies.push(failure, ok());
		assert.deepEqual(await workshop.finishTask(account, 88, 999), { success: true });
		assert.equal(requests.length, 2);
		assert.equal(requests[0].url.href, requests[1].url.href);
		assert.equal(requests[0].body, requests[1].body);
		assert.deepEqual(delays, [750]);
	});
}

test("rate limit stops after ten attempts with capped exponential jitter", async (t) => {
	const { workshop, replies, requests, delays } = await setup(t);
	t.mock.method(Math, "random", () => 0.5);
	replies.push(...Array.from({ length: 10 }, () => ({ body: { retcode: -500004 } })));
	assert.equal((await workshop.claimTaskReward(account, 88, 999)).success, false);
	assert.equal(requests.length, 10);
	assert.deepEqual(delays, [750, 1250, 2250, 4250, 8250, 15250, 15250, 15250, 15250]);
});

for (const method of ["finishTask", "claimTaskReward", "exchangeItem"]) {
	for (const failure of [{ body: { retcode: -1, message: "Synthetic error" } }, { statusCode: 503, body: { message: "Synthetic error" } }]) {
		test(`${method} preserves API/HTTP failure ${failure.statusCode ?? -1}`, async (t) => {
			const { workshop, replies, requests, delays } = await setup(t);
			replies.push(failure);
			assert.deepEqual(await workshop[method](account, 88, 999), { success: false, message: "Synthetic error" });
			assert.equal(requests.length, 1);
			assert.deepEqual(delays, []);
		});
	}
}

test("zero-cost cosmetic with empty code is claimed without redemption", async (t) => {
	const { workshop, replies, requests, delays } = await setup(t);
	replies.push(info(), ok({ task_list: []}), info(), shop([{ award_id: 77, name: "Synthetic frame", cost: 0, status: 1 }]), ok({ type: 2, exchange_code: "", award_id: 77 }));
	const { data } = await workshop.run(account);
	assert.deepEqual(data.freeItemsClaimed, ["Synthetic frame"]);
	assert.deepEqual(data.codesRedeemed, []);
	assert.deepEqual(data.codesObtained, []);
	assert.equal(data.points, 20);
	assert.equal(requests.length, 5);
	assert.deepEqual(delays, [1000]);
});

// Point exchanges remain synthetic regression coverage, not captured success evidence.
for (const redeem of [true, false]) {
	test(`point exchange preserves optional browser redemption (${redeem})`, async (t) => {
		const { workshop, replies, requests, delays } = await setup(t, "it-it");
		replies.push(info(), ok({ task_list: []}), info(), shop([{ award_id: 77, name: "Synthetic Primogems", cost: 10, status: 1 }]), ok({ type: 1, exchange_code: "SYNTHETICCODE", award_id: 77 }), ok());
		const { data } = await workshop.run({ ...account, hilichurl: { redeem } });
		assert.equal(data.points, 10);
		assert.deepEqual(data.codesRedeemed, redeem ? ["SYNTHETICCODE"] : []);
		assert.deepEqual(data.codesObtained, redeem ? [] : ["SYNTHETICCODE"]);
		assert.deepEqual(delays, redeem ? [5000, 1500] : [1500]);
		assert.equal(requests.length, redeem ? 6 : 5);
		if (redeem) {
			assert.equal(requests[5].url.origin + requests[5].url.pathname, REDEMPTION_URL);
			assert.equal(requests[5].url.searchParams.get("lang"), "it");
			assert.equal(requests[5].headers.ds, undefined);
		}
	});
}
