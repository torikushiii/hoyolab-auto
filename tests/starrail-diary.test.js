const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const StarRail = require("../hoyolab-modules/starrail/index.js");
const HoyoLab = require("../hoyolab-modules/template.js");

const cookie = "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id; ltmid_v2=synthetic-mid; cookie_token_v2=synthetic-cookie-token; account_mid_v2=synthetic-account-mid; account_id_v2=synthetic-account-id";
const role = {
	game_id: 6,
	game_role_id: "synthetic-role",
	nickname: "Synthetic Traveler",
	region: "prod_official_eur",
	level: 20,
	logo: "https://example.invalid/logo.png"
};
const card = (list = [{ game_id: 2 }, role]) => ({ body: { retcode: 0, data: { list } } });
const setup = async (t, language) => {
	const harness = await createHttpHarness(t, { language });
	t.mock.method(Date.prototype, "getFullYear", () => 2030);
	t.mock.method(Date.prototype, "getMonth", () => 8);
	t.mock.method(require("node:timers/promises"), "setTimeout", async () => {});
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.Error = class extends Error {
		constructor ({ message }) { super(message); }
	};
	app.Utils = new (require("../singleton/utils.js"))();
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
	const game = new StarRail({ id: 1,
		data: [{
			cookie,
			stamina: { check: true, threshold: 100, persistent: false },
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

const summary = (overrides = {}, month = "203009") => ({ body: { retcode: 0,
	data: {
		login_flag: true,
		month: "203009",
		data_month: month,
		month_data: {
			current_hcoin: 100,
			current_rails_pass: 5,
			// Comparison fields are not the selected month's totals.
			last_hcoin: 999,
			last_rails_pass: 99,
			hcoin_rate: 0,
			rails_rate: 0,
			group_by: [
				{ action: "synthetic_a", action_name: "Avventura", num: 40, percent: 40 },
				{ action: "synthetic_b", action_name: "Missioni", num: 60, percent: 60 }
			],
			...overrides
		}
	} } });
const previous = (overrides = {}) => summary(overrides, "203008");

const assertRequest = (request, month, language = "en-us") => {
	assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
	assert.equal(request.url.pathname, "/event/srledger/month_info");
	assert.equal(request.method, "GET");
	assert.equal(request.body, undefined);
	assert.deepEqual(Object.fromEntries(request.url.searchParams), {
		uid: role.game_role_id, region: "prod_official_eur", month: String(month), lang: language
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
		replies.push(card(), summary(), previous({ current_hcoin: 200,
			current_rails_pass: 9,
			group_by: [{ action: "synthetic_mail", action_name: "Posta", num: 200, percent: 100 }]}));
		await game.login();
		const result = await game.diary(game.accounts[0]);
		assert.deepEqual(result, { success: true,
			data: {
				currentMonth: { jades: { totalNum: 100,
					actionPercentages: [
						{ category: "Missioni", total: 60, percentage: "60" },
						{ category: "Avventura", total: 40, percentage: "40" }
					]},
				pass: 5 },
				lastMonth: { jades: { totalNum: 200, actionPercentages: [{ category: "Posta", total: 200, percentage: "100" }]}, pass: 9 },
				jadeIncomeDecreasePercentage: "50",
				assets: { ...game.config.assets, logo: role.logo, color: 0xBB0BB5 }
			} });
		const month = 203009;
		assertRequest(requests[1], month, language);
		assertRequest(requests[2], month - 1, language);
		assert.equal(writes.length, 1);
		assert.equal(writes[0].key, `starrail:${role.game_role_id}:diary`);
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
	["numeric action key", summary({ group_by: [{ action: 1, action_name: "Posta", num: 100, percent: 100 }]})],
	["missing localized label", summary({ group_by: [{ action: "synthetic", num: 100, percent: 100 }]})],
	["negative total", summary({ current_hcoin: -1 })],
	["invalid total", summary({ current_rails_pass: "5000" })]
]) {
	test(`Diary rejects ${name} without caching partial data`, async (t) => {
		const { game, replies, writes, logs } = await setup(t);
		if (response.body?.data) {
			response.body.data.data_month = "203008";
		}
		replies.push(card(), summary(), response);
		await game.login();
		assert.deepEqual(await game.diary(game.accounts[0]), { success: false });
		assert.equal(writes.length, 0);
		assert.equal(JSON.stringify(logs).includes("synthetic-token"), false);
	});
}

for (const [name, overrides] of [
	["wrong month", { data_month: "203009" }],
	["missing month", { data_month: undefined }],
	["logged out", { login_flag: false }],
	["missing nested summary", { month_data: undefined }]
]) {
	test(`Diary rejects ${name} in history without caching the current month`, async (t) => {
		const { game, replies, writes } = await setup(t);
		const history = previous();
		Object.assign(history.body.data, overrides);
		replies.push(card(), summary(), history);
		await game.login();
		assert.deepEqual(await game.diary(game.accounts[0]), { success: false });
		assert.equal(writes.length, 0);
	});
}

test("Diary handles transport failure without logging credentials or caching", async (t) => {
	const { game, replies, writes, logs } = await setup(t);
	replies.push(card());
	await game.login();
	t.mock.method(app, "Got", async () => {
		throw new Error(cookie);
	});
	assert.deepEqual(await game.diary(game.accounts[0]), { success: false });
	assert.equal(writes.length, 0);
	assert.equal(JSON.stringify(logs).includes("synthetic-token"), false);
});

test("Diary retries history independently and stops without caching partial data", async (t) => {
	const { game, replies, requests, writes } = await setup(t);
	const delays = [];
	t.mock.method(require("node:timers/promises"), "setTimeout", async ms => delays.push(ms));
	replies.push(card(), summary(), ...Array.from({ length: 4 }, () => ({ body: { retcode: -500001 } })));
	await game.login();
	assert.deepEqual(await game.diary(game.accounts[0]), { success: false });
	assert.deepEqual(delays, [1000, 5000, 5000, 5000]);
	for (const request of requests.slice(2)) {
		assertRequest(request, "203008");
	}
	assert.equal(writes.length, 0);
});

test("Diary omits zero-valued groups and preserves Pass-only income", async (t) => {
	const { game, replies } = await setup(t);
	const emptyGroups = [{ action: "synthetic_zero", action_name: "Posta", num: 0, percent: 0 }];
	replies.push(card(), summary({ current_hcoin: 0, group_by: emptyGroups }), previous({ current_hcoin: 0, group_by: emptyGroups }));
	await game.login();
	const result = await game.diary(game.accounts[0]);
	assert.equal(result.success, true);
	assert.deepEqual(result.data.currentMonth, { jades: { totalNum: 0, actionPercentages: []}, pass: 5 });
	assert.equal(result.data.jadeIncomeDecreasePercentage, null);
});

test("Diary retries rate limits with a bounded delay", async (t) => {
	const { game, replies, requests } = await setup(t);
	const delays = [];
	t.mock.method(require("node:timers/promises"), "setTimeout", async ms => delays.push(ms));
	replies.push(card(), { body: { retcode: -500001 } }, summary(), previous());
	await game.login();
	assert.equal((await game.diary(game.accounts[0])).success, true);
	assert.deepEqual(delays, [5000, 1000]);
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

for (const [monthIndex, current, prior] of [[0, "203001", "202912"], [11, "203012", "203011"]]) {
	test(`Diary requests the correct year/month for ${current}`, async (t) => {
		const { game, replies, requests } = await setup(t);
		t.mock.method(Date.prototype, "getMonth", () => monthIndex);
		replies.push(card(), summary({}, current), summary({}, prior));
		await game.login();
		assert.equal((await game.diary(game.accounts[0])).success, true);
		assertRequest(requests[1], current);
		assertRequest(requests[2], prior);
	});
}

for (const current of [0, 100]) {
	test(`Diary command renders empty history with current income ${current}`, async (t) => {
		const { game, replies } = await setup(t);
		replies.push(card(), summary(current === 0 ? { current_hcoin: 0, group_by: []} : {}), previous({ current_hcoin: 0, current_rails_pass: 0, group_by: []}));
		await game.login();
		app.HoyoLab.get = () => game;
		let rendered;
		await require("../commands/diary/index.js").run({ interaction: {
			deferReply: async () => {}, editReply: async value => { rendered = value; }
		} }, "starrail", role.game_role_id);
		const [embed] = rendered.embeds;
		assert.match(embed.description, /comparison is unavailable/);
		assert.equal(embed.fields[5].value, "No income recorded.");
		assert.ok(embed.fields.every(field => field.value.length > 0));
		assert.doesNotMatch(JSON.stringify(embed), /NaN|Infinity/);
	});
}
