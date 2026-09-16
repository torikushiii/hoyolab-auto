const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const StarRail = require("../hoyolab-modules/starrail/index.js");
const Honkai = require("../hoyolab-modules/honkai/index.js");
const Utils = require("../singleton/utils.js");
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
const setup = async (t, language, hi3 = false) => {
	const harness = await createHttpHarness(t, { language });
	t.mock.method(Date, "now", () => 1700000000000);
	app.Utils = new Utils();
	t.mock.method(app.Utils, "randomString", () => "Ab12Cd");
	t.mock.method(Date.prototype, "getMonth", () => 8);
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
	const Game = hi3 ? Honkai : StarRail;
	const game = new Game({ id: 1,
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

const signature = "1700000000,Ab12Cd,8b6b766be8ab9cb664a6913e8d5a4909";
const dailyNote = (overrides = {}) => ({ body: { retcode: 0,
	data: {
		current_stamina: 40,
		max_stamina: 300,
		stamina_recover_time: 93600,
		current_reserve_stamina: 80,
		is_reserve_stamina_full: false,
		current_train_score: 200,
		max_train_score: 500,
		weekly_cocoon_cnt: 1,
		weekly_cocoon_limit: 3,
		current_rogue_score: 1000,
		max_rogue_score: 14000,
		rogue_tourn_weekly_cur: 500,
		rogue_tourn_weekly_max: 1000,
		rogue_tourn_weekly_unlocked: true,
		expeditions: [],
		...overrides
	} } });
const assertRequest = (request, notes = false, hi3 = false, language = "en-us", expectedCookie = cookie) => {
	assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
	assert.equal(request.url.pathname, notes
		? "/event/game_record/hkrpg/api/note"
		: `${hi3 ? "" : "/event"}/game_record/card/wapi/getGameRecordCard`);
	assert.equal(request.method, "GET");
	assert.equal(request.body, undefined);
	assert.deepEqual(Object.fromEntries(request.url.searchParams), notes
		? { server: role.region, role_id: role.game_role_id }
		: { uid: "synthetic-id" });
	assert.equal(request.headers.cookie, expectedCookie);
	assert.equal(request.headers.ds, signature);
	assert.equal(request.headers.origin, "https://act.hoyolab.com");
	assert.equal(request.headers.referer, "https://act.hoyolab.com/");
	assert.equal(request.headers.accept, "application/json, text/plain, */*");
	assert.match(request.headers["user-agent"], /Chrome/);
	assert.doesNotMatch(request.headers["user-agent"], /Android|wv|miHoYoBBS/);
	assert.deepEqual(Object.fromEntries(Object.entries(request.headers).filter(([key]) => key.startsWith("x-rpc-"))), {
		"x-rpc-client_type": 5,
		"x-rpc-app_version": "1.5.0",
		...(hi3 ? {} : { "x-rpc-platform": 4 }),
		"x-rpc-language": language
	});
	assert.equal(request.headers["x-requested-with"], undefined);
};

for (const hi3 of [false, true]) {
	for (const language of [undefined, "it-it"]) {
		test(`signed desktop discovery preserves roles (${hi3 ? "HI3" : "HSR"}, ${language ?? "default"})`, async (t) => {
			const { game, replies, requests } = await setup(t, language, hi3);
			replies.push(card([{ game_id: 2 }, { ...role, game_id: hi3 ? 1 : 6 }]));
			await game.login();
			assert.equal(game.accounts.length, 1);
			const [account] = game.accounts;
			for (const key of ["nickname", "level", "region"]) {
				assert.equal(account[key], role[key]);
			}
			assert.equal(account.uid, role.game_role_id);
			assert.equal(account.cookie, cookie);
			assert.equal(account.timezone, "EU");
			assertRequest(requests[0], false, hi3, language);
			if (!hi3) {
				assert.equal(account.redeemCode, true);
				assert.equal(account.weekliesCheck, true);
				assert.equal(account.expedition.fired, false);
				replies.push(dailyNote());
				const result = await game.notes(account);
				assert.deepEqual(result.data.stamina, { currentStamina: 40,
					maxStamina: 300,
					recoveryTime: 93600,
					reserveStamina: 80,
					isReserveStaminaFull: false });
				assert.deepEqual(result.data.dailies, { task: 200, maxTask: 500 });
				assert.deepEqual(result.data.weeklies, { weeklyBoss: 1,
					weeklyBossLimit: 3,
					rogueScore: 1000,
					maxScore: 14000,
					tournScore: 500,
					tournMaxScore: 1000,
					tournUnlocked: true });
				assert.deepEqual(result.data.expedition, { completed: true, list: []});
				const cached = await game.notes(account);
				for (const key of ["dailies", "weeklies", "expedition", "assets"]) {
					assert.deepEqual(cached.data[key], result.data[key]);
				}
				assert.deepEqual(cached.data.stamina, { ...result.data.stamina, recoveryTime: 93599 });
				assert.equal(requests.length, 2);
				assertRequest(requests[1], true, false, language);
			}
		});
	}
	for (const [name, response, message] of [
		["HTTP error", { statusCode: 403 }, /Failed to login/],
		["API error", { body: { retcode: -100 } }, /Failed to login/],
		["invalid list", { body: { retcode: 0, data: {} } }, /Invalid data/],
		["missing role", card([{ game_id: 2 }]), /No Honkai/]
	]) {
		test(`discovery rejects ${name} (HI3=${hi3})`, async (t) => {
			const { game, replies, requests } = await setup(t, undefined, hi3);
			replies.push(response);
			await assert.rejects(game.login(), message);
			assert.deepEqual(game.accounts, []);
			assert.equal(requests.length, 1);
			assertRequest(requests[0], false, hi3);
		});
	}
}
for (const [name, response, quiet] of [
	["HTTP error", { statusCode: 403 }, false],
	["API error", { body: { retcode: -100 } }, false],
	["private Notes", { body: { retcode: 10102 } }, false],
	["quiet error", { body: { retcode: -501000 } }, true]
]) {
	test(`Notes preserves ${name} handling without cache writes or privacy changes`, async (t) => {
		const { game, replies, requests, writes, logs } = await setup(t);
		replies.push(card(), response);
		await game.login();
		logs.length = 0;
		assert.deepEqual(await game.notes(game.accounts[0]), { success: false });
		assert.equal(writes.length, 0);
		assert.equal(logs.filter(([, details]) => typeof details === "object").length, quiet ? 0 : 1);
		assert.equal(JSON.stringify(logs).includes("synthetic-token"), false);
		assert.equal(requests.length, 2);
		assertRequest(requests[1], true);
	});
}

test("Notes refreshes at the threshold, keeps full cookies and maps active expeditions", async (t) => {
	const { game, replies, requests, writes } = await setup(t);
	replies.push(card(), dailyNote({ current_stamina: 100 }), dailyNote({ expeditions: [
		{ avatars: ["https://example.invalid/avatar.png"], status: "Ongoing", remaining_time: 3600 },
		{ avatars: [], status: "Finished", remaining_time: 0 }
	]}));
	await game.login();
	const [account] = game.accounts;
	account.cookie += "; synthetic_extra=synthetic-value";
	await game.notes(account);
	const result = await game.notes(account);
	assert.equal(result.data.stamina.currentStamina, 40);
	assert.deepEqual(result.data.expedition, { completed: false,
		list: [
			{ avatar: ["https://example.invalid/avatar.png"], status: "Ongoing", remaining_time: 3600 },
			{ avatar: [], status: "Finished", remaining_time: 0 }
		]});
	assert.equal(writes.length, 3); // Initial response, cache aging, refreshed response.
	assert.equal(requests.length, 3);
	assertRequest(requests[2], true, false, "en-us", account.cookie);
});

for (const platformId of [1, 2]) {
	test(`HSR Notes command preserves consumer output on platform ${platformId}`, async (t) => {
		const { game, replies, requests } = await setup(t);
		replies.push(card(), dailyNote({ expeditions: [{ avatars: [], status: "Ongoing", remaining_time: 3600 }]}));
		await game.login();
		Object.assign(app.HoyoLab, {
			supportedGames: () => ["starrail"], getActiveAccounts: () => game.accounts, get: () => game
		});
		const sent = [];
		app.Platform = { get: () => ({ send: async message => sent.push(message) }) };
		const context = { platform: { id: platformId } };
		if (platformId === 1) {
			context.interaction = { reply: async message => sent.push(message) };
		}
		await require("../commands/notes/index.js").run(context, "starrail");
		assert.equal(sent.length, 1);
		assert.match(JSON.stringify(sent[0]), /Divergent Universe: 500\/1000/);
		assert.match(JSON.stringify(sent[0]), /Simulated Universe: 1000\/14000/);
		assert.equal(requests.length, 2);
		assertRequest(requests[1], true);
	});
}
