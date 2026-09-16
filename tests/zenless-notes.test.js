const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const Zenless = require("../hoyolab-modules/zenless/index.js");
const HoyoLab = require("../hoyolab-modules/template.js");

const cookie = "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id; ltmid_v2=synthetic-mid; cookie_token_v2=synthetic-cookie-token; account_mid_v2=synthetic-account-mid; account_id_v2=synthetic-account-id";
const role = {
	game_id: 8,
	game_role_id: "synthetic-role",
	nickname: "Synthetic Proxy",
	region: "prod_gf_eu",
	level: 20,
	logo: "https://example.invalid/logo.png"
};
const card = (list = [{ game_id: 6 }, role]) => ({ body: { retcode: 0, data: { list } } });
const dailyNote = (overrides = {}) => ({
	body: { retcode: 0,
		data: {
			energy: { progress: { current: 40, max: 240 }, restore: 72000 },
			vitality: { current: 200, max: 400 },
			vhs_sale: { sale_state: "SaleStateDoing" },
			card_sign: "CardSignDone",
			bounty_commission: null,
			survey_points: null,
			coffee: null,
			weekly_task: null,
			...overrides
		} }
});

const setup = async (t, language) => {
	const harness = await createHttpHarness(t, { language });
	t.mock.method(Date, "now", () => 1800000000000);
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
	const game = new Zenless({ id: 1,
		data: [{
			cookie,
			stamina: { check: true, threshold: 100, persistent: false },
			redeemCode: true,
			dailiesCheck: true,
			shopStatus: true
		}]});
	app.HoyoLab = {
		getRegion: (region) => region === "prod_gf_tw" ? "TW/HK/MO" : "EU",
		errorMessage: HoyoLab.errorMessage,
		getAccountById: (uid) => game.accounts.find(account => account.uid === uid)
	};
	return { ...harness, game, cache, writes };
};

const assertRequest = (request, notes, language = "en-us", expectedCookie = cookie) => {
	assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
	assert.equal(request.url.pathname, notes
		? "/event/game_record_zzz/api/zzz/note"
		: "/game_record/card/wapi/getGameRecordCard");
	assert.equal(request.method, "GET");
	assert.equal(request.body, undefined);
	assert.deepEqual(Object.fromEntries(request.url.searchParams), notes
		? { server: "prod_gf_eu", role_id: role.game_role_id }
		: { uid: "synthetic-id" });
	assert.equal(request.headers.cookie, expectedCookie);
	assert.equal(request.headers.origin, "https://act.hoyolab.com");
	assert.equal(request.headers.referer, "https://act.hoyolab.com/");
	assert.equal(request.headers.accept, "application/json, text/plain, */*");
	assert.equal(request.headers["x-rpc-client_type"], undefined);
	assert.equal(request.headers["x-rpc-platform"], 2);
	assert.equal(request.headers["x-rpc-app_version"], "4.20.0");
	assert.equal(request.headers["x-rpc-language"], language);
	assert.equal(request.headers["x-rpc-lang"], language);
	assert.equal(request.headers["x-rpc-env"], undefined);
	assert.equal(request.headers["x-requested-with"], "com.mihoyo.hoyolab");
	assert.match(request.headers["user-agent"], /Android.*wv.*miHoYoBBSOversea\/4\.20\.0/);
	for (const header of ["ds", "x-rpc-signgame", "x-rpc-page", "x-rpc-device_id", "x-rpc-device_fp"]) {
		assert.equal(request.headers[header], undefined, header);
	}
};

for (const language of [undefined, "it-it"]) {
	test(`discovery and Notes preserve account, parser and cache contracts (${language ?? "default"})`, async (t) => {
		const { game, requests, replies, cache, writes } = await setup(t, language);
		replies.push(card(), dailyNote());
		assert.equal(await game.login(), undefined);
		assert.equal(game.accounts.length, 1);
		const [account] = game.accounts;
		assert.equal(account.uid, role.game_role_id);
		assert.equal(account.nickname, role.nickname);
		assert.equal(account.level, role.level);
		assert.equal(account.timezone, "EU");
		assert.equal(account.cookie, cookie);
		assert.equal(account.redeemCode, true);
		assert.equal(account.dailiesCheck, true);
		assert.equal(account.shop.check, true);
		assert.equal(account.assets.logo, role.logo);
		assert.equal(account.assets.notes, game.config.url.notes);
		assert.equal(account.stamina.fired, false);
		assert.equal(account.shop.fired, false);
		const result = await game.notes(account);
		assert.deepEqual(result, { success: true,
			data: {
				cardSign: "Completed",
				stamina: { currentStamina: 40, maxStamina: 240, recoveryTime: 72000 },
				dailies: { task: 200, maxTask: 400 },
				weeklies: { bounty: 0, bountyTotal: 0, surveyPoints: 0, surveyPointsTotal: 0 },
				shop: { state: "Open" },
				assets: { ...game.config.assets, logo: role.logo, color: 0xFF8300 }
			} });
		assert.equal(writes[0].expiry, 3600000);
		assert.equal(cache.get(account.uid).nickname, role.nickname);
		for (const key of ["stamina", "dailies", "weeklies", "shop", "cardSign"]) {
			assert.deepEqual(cache.get(account.uid)[key], result.data[key]);
		}
		const cached = await game.notes(account);
		assert.equal(cached.success, true);
		assert.equal(cached.data.stamina.currentStamina, 40);
		assert.deepEqual(cached.data.assets, result.data.assets);
		assert.deepEqual(cached.data.dailies, result.data.dailies);
		assert.equal(requests.length, 2);
		assertRequest(requests[0], false, language);
		assertRequest(requests[1], true, language);
	});
}

test("discovery preserves the TW/HK/MO timezone mapping", async (t) => {
	const { game, replies } = await setup(t);
	replies.push(card([{ ...role, region: "prod_gf_tw" }]));
	await game.login();
	assert.equal(game.accounts[0].timezone, "SEA");
});

for (const [name, response, message] of [
	["HTTP failure", { statusCode: 403 }, /Failed to login/],
	["API failure", { body: { retcode: -100 } }, /Failed to login/],
	["invalid list", { body: { retcode: 0, data: {} } }, /Invalid data object/],
	["no Zenless role", card([{ game_id: 6 }]), /No Zenless Zone Zero account/]
]) {
	test(`discovery rejects ${name}`, async (t) => {
		const { game, replies, requests } = await setup(t);
		replies.push(response);
		await assert.rejects(game.login(), message);
		assert.deepEqual(game.accounts, []);
		assert.equal(requests.length, 1);
		assertRequest(requests[0], false);
	});
}

for (const [name, response, message] of [
	["private Notes", { body: { retcode: 10102, message: "Data is not public for the user" } }, /HoyoLab returned non-zero retcode/],
	["HTTP failure", { statusCode: 403 }, /Failed to fetch data/],
	["API failure", { body: { retcode: -100 } }, /HoyoLab returned non-zero retcode/],
	["quiet API failure", { body: { retcode: -501000 } }, null]
]) {
	test(`Notes handles ${name} without caching or privacy mutations`, async (t) => {
		const { game, replies, requests, logs, writes } = await setup(t);
		replies.push(card(), response);
		await game.login();
		logs.length = 0;
		assert.deepEqual(await game.notes(game.accounts[0]), { success: false });
		assert.equal(writes.length, 0);
		assert.equal(requests.length, 2);
		assertRequest(requests[1], true);
		const errors = logs.filter(([, details]) => typeof details === "object");
		if (message) {
			assert.equal(errors.length, 1);
			assert.match(errors[0][1].message, message);
		}
		else {
			assert.equal(errors.length, 0);
		}
		assert.equal(JSON.stringify(logs).includes("synthetic-token"), false);
	});
}

for (const [name, overrides] of [
	["stamina threshold", { energy: { progress: { current: 100, max: 240 }, restore: 50400 } }],
	["finished shop", { vhs_sale: { sale_state: "SaleStateDone" } }]
]) {
	test(`Notes refreshes cache for ${name}`, async (t) => {
		const { game, replies, requests } = await setup(t);
		replies.push(card(), dailyNote(overrides), dailyNote());
		await game.login();
		const [account] = game.accounts;
		await game.notes(account);
		const result = await game.notes(account);
		assert.equal(result.data.shop.state, "Open");
		assert.equal(result.data.stamina.currentStamina, 40);
		assert.equal(requests.length, 3);
		assertRequest(requests[2], true);
	});
}

test("Notes forwards the complete supplied cookie, including fields outside the legacy whitelist", async (t) => {
	const { game, replies, requests } = await setup(t);
	replies.push(card(), dailyNote());
	await game.login();
	const [account] = game.accounts;
	account.cookie += "; synthetic_extra=synthetic-value";
	await game.notes(account);
	assertRequest(requests[1], true, "en-us", account.cookie);
});

for (const [name, response, expected] of [
	["null data", { body: { retcode: 0, data: null } }, { success: false, error: "No data received from API" }],
	["missing energy", dailyNote({ energy: null }), { success: false }],
	["missing vitality", dailyNote({ vitality: null }), { success: false }]
]) {
	test(`Notes rejects ${name} without cache writes`, async (t) => {
		const { game, replies, requests, writes } = await setup(t);
		replies.push(card(), response);
		await game.login();
		assert.deepEqual(await game.notes(game.accounts[0]), expected);
		assert.equal(writes.length, 0);
		assert.equal(requests.length, 2);
		assertRequest(requests[1], true);
	});
}

test("Notes preserves populated weekly totals and scratch card/shop states", async (t) => {
	const { game, replies } = await setup(t);
	replies.push(card(), dailyNote({
		bounty_commission: { num: 2, total: 3 },
		survey_points: { num: 100, total: 8000 },
		card_sign: "CardSignNo",
		vhs_sale: { sale_state: "SaleStateNo" }
	}));
	await game.login();
	const result = await game.notes(game.accounts[0]);
	assert.deepEqual(result.data.weeklies, { bounty: 2, bountyTotal: 3, surveyPoints: 100, surveyPointsTotal: 8000 });
	assert.equal(result.data.cardSign, "Not Completed");
	assert.equal(result.data.shop.state, "Closed");
});

for (const platformId of [1, 2]) {
	test(`Notes command renders nullable weekly data on platform ${platformId}`, async (t) => {
		const { game, replies, requests } = await setup(t);
		replies.push(card(), dailyNote());
		await game.login();
		Object.assign(app.HoyoLab, {
			supportedGames: () => ["nap"],
			getActiveAccounts: () => game.accounts,
			get: () => game
		});
		app.Utils = { formatTime: () => "synthetic time", escapeCharacters: value => value };
		const sent = [];
		app.Platform = { get: () => ({ send: async message => sent.push(message) }) };
		const context = { platform: { id: platformId } };
		if (platformId === 1) {
			context.interaction = { reply: async message => sent.push(message) };
		}
		await require("../commands/notes/index.js").run(context, "zzz");
		assert.equal(sent.length, 1);
		if (platformId === 1) {
			const [embed] = sent[0].embeds;
			assert.equal(embed.color, 0xFF8300);
			assert.equal(embed.fields.find(field => field.name === "Weeklies").value, "Bounty Commission: 0/0\nSurvey Points: 0/0");
			assert.equal(embed.fields.find(field => field.name === "Shop Status").value, "Open");
			assert.equal(embed.fields.find(field => field.name === "Scratch Card").value, "Completed");
		}
		else {
			assert.match(sent[0], /Bounty Commission: 0\/0\nSurvey Points: 0\/0\nShop Status: Open\nHowl Scratch Card: Completed/);
		}
		assert.equal(requests.length, 2);
		assertRequest(requests[1], true);
	});
}
