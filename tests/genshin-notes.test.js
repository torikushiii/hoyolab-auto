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
const dailyNote = (overrides = {}) => ({
	body: { retcode: 0,
		data: {
			current_resin: 40,
			max_resin: 200,
			resin_recovery_time: "76800",
			remain_resin_discount_num: 2,
			resin_discount_num_limit: 3,
			current_home_coin: 100,
			max_home_coin: 2400,
			home_coin_recovery_time: "3600",
			daily_task: {
				total_num: 4,
				finished_num: 2,
				is_extra_task_reward_received: false,
				stored_attendance: 3,
				stored_attendance_refresh_countdown: 7200
			},
			expeditions: [{ status: "Ongoing", avatar_side_icon: "https://example.invalid/avatar.png", remained_time: "1800" }],
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

const assertRequest = (request, notes, language = "en-us", expectedCookie = cookie) => {
	assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
	assert.equal(request.url.pathname, notes
		? "/event/game_record/app/genshin/api/dailyNote"
		: "/event/game_record/card/wapi/getGameRecordCard");
	assert.equal(request.method, "GET");
	assert.equal(request.body, undefined);
	assert.deepEqual(Object.fromEntries(request.url.searchParams), notes
		? { server: "os_euro", role_id: role.game_role_id }
		: { uid: "synthetic-id" });
	assert.equal(request.headers.cookie, expectedCookie);
	assert.equal(request.headers.origin, "https://act.hoyolab.com");
	assert.equal(request.headers.referer, "https://act.hoyolab.com/");
	assert.equal(request.headers.accept, "application/json, text/plain, */*");
	assert.equal(request.headers["x-rpc-client_type"], 5);
	assert.equal(request.headers["x-rpc-platform"], notes ? 2 : 4);
	assert.equal(request.headers["x-rpc-app_version"], notes ? "4.21.0" : "1.5.0");
	assert.equal(request.headers["x-rpc-language"], language);
	assert.equal(request.headers["x-rpc-lang"], language);
	assert.equal(request.headers["x-rpc-env"], "default");
	assert.equal(request.headers["x-requested-with"], notes ? "com.mihoyo.hoyolab" : undefined);
	assert.match(request.headers["user-agent"], notes ? /Android.*wv.*miHoYoBBSOversea\/4\.21\.0/ : /Windows NT/);
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
		assert.equal(account.weekliesCheck, true);
		assert.equal(account.assets.logo, role.logo);
		assert.equal(account.assets.notes, game.config.url.notes);
		assert.equal(account.stamina.fired, false);
		assert.equal(account.expedition.fired, false);
		assert.equal(account.realm.fired, false);
		const result = await game.notes(account);
		assert.deepEqual(result, { success: true,
			data: {
				stamina: { currentStamina: 40, maxStamina: 200, recoveryTime: "76800" },
				dailies: { task: 2, maxTask: 4, storedAttendance: 3, storedAttendanceRefresh: 7200 },
				weeklies: { resinDiscount: 2, resinDiscountLimit: 3 },
				realm: { currentCoin: 100, maxCoin: 2400, recoveryTime: "3600" },
				expedition: { completed: false, list: [{ avatar: "https://example.invalid/avatar.png", status: "Ongoing", remaining_time: "1800" }]},
				assets: { ...game.config.assets, logo: role.logo, color: 0x0099FF }
			} });
		assert.equal(writes[0].expiry, 3600000);
		assert.equal(cache.get(account.uid).nickname, role.nickname);
		for (const key of ["stamina", "dailies", "weeklies", "realm", "expedition"]) {
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
	replies.push(card([{ ...role, region: "os_cht" }]));
	await game.login();
	assert.equal(game.accounts[0].timezone, "SEA");
});

for (const [name, response, message] of [
	["HTTP failure", { statusCode: 403 }, /Failed to login/],
	["API failure", { body: { retcode: -100 } }, /Failed to login/],
	["invalid list", { body: { retcode: 0, data: {} } }, /Invalid data object/],
	["no Genshin role", card([{ game_id: 6 }]), /No Genshin account/]
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
	["private Notes", { body: { retcode: 10102, message: "Data is not public for the user" } }, /Enable Realtime Notes in HoYoLAB/],
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

test("Notes refreshes at the stamina threshold and preserves completed expeditions", async (t) => {
	const { game, replies, requests } = await setup(t);
	replies.push(card(), dailyNote({ current_resin: 100 }), dailyNote({
		expeditions: [{ status: "Finished", avatar_side_icon: "https://example.invalid/avatar.png", remained_time: "0" }]
	}));
	await game.login();
	const [account] = game.accounts;
	await game.notes(account);
	const result = await game.notes(account);
	assert.equal(result.data.expedition.completed, true);
	assert.equal(result.data.stamina.currentStamina, 40);
	assert.equal(requests.length, 3);
	assertRequest(requests[2], true);
});

test("Notes forwards the complete supplied cookie, including fields outside the legacy whitelist", async (t) => {
	const { game, replies, requests } = await setup(t);
	replies.push(card(), dailyNote());
	await game.login();
	const [account] = game.accounts;
	account.cookie += "; synthetic_extra=synthetic-value";
	await game.notes(account);
	assertRequest(requests[1], true, "en-us", account.cookie);
});
