const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const Genshin = require("../hoyolab-modules/genshin/index.js");
const HoyoLab = require("../hoyolab-modules/template.js");

const cookie = "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id; ltmid_v2=synthetic-mid; cookie_token_v2=synthetic-cookie-token; account_mid_v2=synthetic-account-mid; account_id_v2=synthetic-account-id";
const role = {
	game_id: 2,
	game_role_id: "synthetic-role",
	nickname: "Synthetic Traveler",
	region: "os_euro",
	level: 20,
	logo: "https://example.invalid/logo.png"
};
const card = (list = [{ game_id: 6 }, role]) => ({ body: { retcode: 0, data: { list } } });
const setup = async (t, language) => {
	const harness = await createHttpHarness(t, { language });
	t.mock.method(require("node:timers/promises"), "setTimeout", async () => {});
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.Error = class extends Error {
		constructor ({ message }) { super(message); }
	};
	app.Date = { now: () => Date.now() };
	const cache = new Map();
	const writes = [];
	app.Cache = {
		get: async (key) => structuredClone(cache.get(key)),
		set: async (entry) => {
			writes.push(structuredClone(entry));
			cache.set(entry.key, structuredClone(entry.value));
		},
		delete: async (key) => cache.delete(key)
	};
	const previousList = [...HoyoLab.list];
	t.after(() => {
		HoyoLab.list = previousList;
	});
	const game = new Genshin({ id: 1,
		data: [{
			cookie,
			stamina: { check: true, threshold: 100, persistent: false },
			realm: { check: true, persistent: false },
			expedition: { check: true, persistent: false },
			redeemCode: true,
			dailiesCheck: true,
			weekliesCheck: true
		}]});
	app.HoyoLab = {
		getRegion: (region) => region === "os_cht" ? "TW/HK/MO" : "EU",
		errorMessage: HoyoLab.errorMessage,
		getAccountById: (uid) => game.accounts.find(account => account.uid === uid)
	};
	return { ...harness, game, cache, writes };
};

const summary = (overrides = {}) => ({ body: { retcode: 0,
	data: {
		current_primogems: 100,
		current_mora: 5000,
		group_by: [
			{ action_id: 1, action: "Avventura", num: 40, percent: 40 },
			{ action_id: 2, action: "Missioni", num: 60, percent: 60 }
		],
		...overrides
	} } });

const assertRequest = (request, month, language = "en-us") => {
	assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
	assert.equal(request.url.pathname, "/event/ysledgeros/month_info");
	assert.equal(request.method, "GET");
	assert.equal(request.body, undefined);
	assert.deepEqual(Object.fromEntries(request.url.searchParams), {
		uid: role.game_role_id, region: "os_euro", month: String(month), lang: language
	});
	assert.equal(request.headers.cookie, cookie);
	assert.equal(request.headers.origin, "https://act.hoyolab.com");
	assert.equal(request.headers.referer, "https://act.hoyolab.com/");
	assert.equal(request.headers.accept, "application/json, text/plain, */*");
	assert.equal(request.headers["x-requested-with"], "com.mihoyo.hoyolab");
	assert.match(request.headers["user-agent"], /Android.*wv.*miHoYoBBSOversea\/4\.20\.0/);
	assert.equal(request.headers.ds, undefined);
	assert.deepEqual(Object.keys(request.headers).filter(key => key.startsWith("x-rpc-")), []);
};

for (const language of [undefined, "it-it"]) {
	test(`Diary uses localized summaries and preserves output/cache (${language ?? "default"})`, async (t) => {
		const { game, replies, requests, writes } = await setup(t, language);
		replies.push(card(), summary(), summary({ current_primogems: 200,
			current_mora: 9000,
			group_by: [{ action_id: 99, action: "Posta", num: 200, percent: 100 }]}));
		await game.login();
		const result = await game.diary(game.accounts[0]);
		assert.deepEqual(result, { success: true,
			data: {
				currentMonth: { primo: { totalNum: 100,
					actionPercentages: [
						{ category: "Missioni", total: 60, percentage: "60" },
						{ category: "Avventura", total: 40, percentage: "40" }
					]},
				mora: 5000 },
				lastMonth: { primo: { totalNum: 200, actionPercentages: [{ category: "Posta", total: 200, percentage: "100" }]}, mora: 9000 },
				primoIncomeDecreasePercentage: "50",
				assets: { ...game.config.assets, logo: role.logo, color: 0x0099FF }
			} });
		const month = new Date().getMonth() + 1;
		assertRequest(requests[1], month, language);
		assertRequest(requests[2], month === 1 ? 12 : month - 1, language);
		assert.equal(writes.length, 1);
		assert.equal(writes[0].key, `genshin:${role.game_role_id}:diary`);
		assert.equal(writes[0].expiry, 7200000);
		assert.equal(writes[0].value.assets, undefined);
		assert.deepEqual(await game.diary(game.accounts[0]), result);
		assert.equal(requests.length, 3);
	});
}

for (const [name, response] of [
	["HTTP error", { statusCode: 403, body: { retcode: 0 } }],
	["API error", { body: { retcode: -100 } }],
	["missing data", { body: { retcode: 0 } }],
	["missing groups", summary({ group_by: undefined })],
	["unavailable non-empty historical groups", summary({ group_by: []})],
	["invalid group", summary({ group_by: [null]})],
	["invalid total", summary({ current_mora: "5000" })]
]) {
	test(`Diary rejects ${name} without caching partial data`, async (t) => {
		const { game, replies, writes, logs } = await setup(t);
		replies.push(card(), summary(), response);
		await game.login();
		assert.deepEqual(await game.diary(game.accounts[0]), { success: false });
		assert.equal(writes.length, 0);
		assert.equal(JSON.stringify(logs).includes("synthetic-token"), false);
	});
}

test("Diary retries rate limits with a bounded delay", async (t) => {
	const { game, replies, requests } = await setup(t);
	const delays = [];
	t.mock.method(require("node:timers/promises"), "setTimeout", async ms => delays.push(ms));
	replies.push(card(), { body: { retcode: -500001 } }, summary(), summary());
	await game.login();
	assert.equal((await game.diary(game.accounts[0])).success, true);
	assert.deepEqual(delays, [5000, 10000]);
	assert.equal(requests[1].url.href, requests[2].url.href);
});

test("Diary stops after three rate-limit retries", async (t) => {
	const { game, replies, requests, writes } = await setup(t);
	replies.push(card(), ...Array.from({ length: 4 }, () => ({ body: { retcode: -500001 } })));
	await game.login();
	assert.deepEqual(await game.diary(game.accounts[0]), { success: false });
	assert.equal(requests.length, 5);
	assert.equal(writes.length, 0);
});

test("January requests December for the historical summary", async (t) => {
	const { game, replies, requests } = await setup(t);
	t.mock.method(Date.prototype, "getMonth", () => 0);
	replies.push(card(), summary(), summary());
	await game.login();
	assert.equal((await game.diary(game.accounts[0])).success, true);
	assertRequest(requests[1], 1);
	assertRequest(requests[2], 12);
});

for (const current of [0, 100]) {
	test(`Diary command renders empty history with current income ${current}`, async (t) => {
		const { game, replies } = await setup(t);
		replies.push(card(), summary(current === 0 ? { current_primogems: 0, group_by: []} : {}), summary({ current_primogems: 0, current_mora: 0, group_by: []}));
		await game.login();
		app.HoyoLab.get = () => game;
		let rendered;
		await require("../commands/diary/index.js").run({ interaction: {
			deferReply: async () => {}, editReply: async value => { rendered = value; }
		} }, "genshin", role.game_role_id);
		const [embed] = rendered.embeds;
		assert.match(embed.description, /comparison is unavailable/);
		assert.equal(embed.fields[5].value, "No income recorded.");
		assert.ok(embed.fields.every(field => field.value.length > 0));
		assert.doesNotMatch(JSON.stringify(embed), /NaN|Infinity/);
	});
}
