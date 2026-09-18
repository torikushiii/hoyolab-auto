const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createRedemptionHarness } = require("./helpers/http.js");
const HoyoLab = require("../hoyolab-modules/template.js");
const StarRail = require("../hoyolab-modules/starrail/index.js");
const Zenless = require("../hoyolab-modules/zenless/index.js");
const starrailCron = require("../crons/code-redeem/starrail.js");
const zenlessCron = require("../crons/code-redeem/zenless.js");
const { MISSING_DEVICE_MESSAGE } = require("../hoyolab-modules/browser-redemption-request.js");

const authCookie = "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id; ltmid_v2=synthetic-mid; cookie_token_v2=synthetic-cookie-token; account_mid_v2=synthetic-account-mid; account_id_v2=synthetic-account-id";
const deviceUuid = "synthetic-device-uuid";
const code = { code: "SYNTHETICCODE", rewards: ["Synthetic reward"]};

const games = {
	starrail: {
		Class: StarRail,
		cron: starrailCron,
		host: "public-operation-hkrpg.hoyoverse.com",
		origin: "https://hsr.hoyoverse.com",
		gameBiz: "hkrpg_global"
	},
	zenless: {
		Class: Zenless,
		cron: zenlessCron,
		host: "public-operation-nap.hoyoverse.com",
		origin: "https://zenless.hoyoverse.com",
		gameBiz: "nap_global"
	}
};

const setup = async (t, language) => {
	const harness = await createRedemptionHarness(t, { language });
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.Error = class extends Error {
		constructor ({ message }) { super(message); }
	};
	app.HoyoLab = {
		isExpiredLogin: () => false,
		parseCookie: HoyoLab.parseCookie,
		errorMessage: HoyoLab.errorMessage
	};
	return harness;
};

const getAccount = (overrides = {}) => ({
	uid: "synthetic-role",
	nickname: "Synthetic account",
	region: "prod_official_eur",
	redeemCode: true,
	cookie: authCookie,
	redemptionDeviceUuid: deviceUuid,
	...overrides
});

const invoke = (game, caller, account) => {
	const definition = games[game];
	if (caller === "cron") {
		return definition.cron.redeemCodes(account, code);
	}
	return definition.Class.prototype.redeemCode.call({
		name: game === "zenless" ? "nap" : game,
		fullName: game,
		config: { url: { redemption: `https://${definition.host}/common/apicdkey/api/webExchangeCdkeyRisk` } }
	}, account, code.code);
};

for (const [game, definition] of Object.entries(games)) {
	for (const caller of ["module", "cron"]) {
		for (const language of [undefined, "it-it"]) {
			test(`${game} ${caller} uses captured browser redemption (${language ?? "default"})`, async (t) => {
				const harness = await setup(t, language);
				harness.replies.push({ body: { retcode: 0, message: "OK" } });
				assert.equal((await invoke(game, caller, getAccount())).success, true);
				assert.equal(harness.requests.length, 1);
				const [request] = harness.requests;
				assert.equal(request.url.host, definition.host);
				assert.equal(request.url.pathname, "/common/apicdkey/api/webExchangeCdkeyRisk");
				assert.equal(request.url.search, "");
				assert.equal(request.method, "POST");
				const body = JSON.parse(request.body);
				assert.equal(typeof body.t, "number");
				delete body.t;
				assert.deepEqual(body, {
					lang: language ? "it" : "en",
					game_biz: definition.gameBiz,
					uid: "synthetic-role",
					region: "prod_official_eur",
					cdkey: code.code,
					platform: "4",
					device_uuid: deviceUuid
				});
				assert.equal(request.headers.cookie, `${authCookie}; _MHYUUID=${deviceUuid}`);
				assert.equal(request.headers.origin, definition.origin);
				assert.equal(request.headers.referer, `${definition.origin}/`);
				assert.equal(request.headers.ds, undefined);
				assert.deepEqual(Object.keys(request.headers).filter(key => key.startsWith("x-rpc-")), []);
			});
		}

		test(`${game} ${caller} requires a new cookie when _MHYUUID is missing`, async (t) => {
			const harness = await setup(t);
			const result = await invoke(game, caller, getAccount({ redemptionDeviceUuid: null }));
			assert.deepEqual(result, caller === "module"
				? { success: false, message: MISSING_DEVICE_MESSAGE }
				: { success: false, reason: MISSING_DEVICE_MESSAGE });
			assert.equal(harness.requests.length, 0);
		});

		for (const retcode of [-2001, -2017, ...(game === "zenless" ? [-2016] : [])]) {
			test(`${game} ${caller} preserves redemption failure ${retcode}`, async (t) => {
				const harness = await setup(t);
				harness.replies.push(...Array.from({ length: retcode === -2016 ? 3 : 1 }, () => ({ body: { retcode, message: "Synthetic API failure" } })));
				const result = await invoke(game, caller, getAccount());
				assert.deepEqual(result, caller === "module"
					? { success: false, message: "Synthetic API failure" }
					: { success: false, reason: retcode === -2001 ? "Expired or invalid code" : "Synthetic API failure", retcode });
				assert.equal(harness.requests.length, retcode === -2016 ? 3 : 1);
			});
		}

		test(`${game} ${caller} preserves HTTP failure behavior`, async (t) => {
			const harness = await setup(t);
			harness.replies.push({ statusCode: 503, body: { message: "Synthetic outage" } });
			if (caller === "module") {
				assert.deepEqual(await invoke(game, caller, getAccount()), { success: false });
			}
			else {
				await assert.rejects(invoke(game, caller, getAccount()), /API returned non-200 status code/);
			}
			assert.equal(harness.requests.length, 1);
		});
	}
}

test("account parsing preserves _MHYUUID outside the normalized auth cookie", async (t) => {
	await setup(t);
	const controller = new HoyoLab("starrail", {
		id: 1,
		data: [{
			cookie: `${authCookie}; _MHYUUID=${deviceUuid}`,
			redeemCode: true,
			stamina: { check: false, threshold: 0, persistent: false }
		}]
	}, { config: { maxStamina: 300 } });
	assert.equal(controller.data[0].redemptionDeviceUuid, deviceUuid);
	assert.equal(controller.data[0].cookie, authCookie);
});

test("account parsing requests a new cookie when redemption identity is absent", async (t) => {
	const { logs } = await setup(t);
	const controller = new HoyoLab("starrail", {
		id: 1,
		data: [{
			cookie: authCookie,
			redeemCode: true,
			stamina: { check: false, threshold: 0, persistent: false }
		}]
	}, { config: { maxStamina: 300 } });
	assert.equal(controller.data[0].redemptionDeviceUuid, null);
	assert.match(JSON.stringify(logs), /newly acquired cookie/);
});

for (const game of Object.keys(games)) {
	test(`${game}: cooldown retries keep browser JSON on the wire and refresh its timestamp`, async (t) => {
		const harness = await setup(t, "it-it");
		harness.replies.push(
			{ body: { retcode: -2016, message: "Please try again in 12 seconds." } },
			{ body: { retcode: 0 } },
			{ body: { retcode: 0 } }
		);
		assert.equal((await invoke(game, "module", getAccount())).success, true);
		assert.equal((await invoke(game, "cron", getAccount())).success, true);
		assert.deepEqual(harness.delays, [13000, 6000]);
		const bodies = harness.requests.map(request => {
			assert.equal(request.method, "POST");
			assert.equal(request.url.search, "");
			assert.equal(request.headers.origin, games[game].origin);
			assert.equal(request.headers.ds, undefined);
			assert.equal(request.headers["x-rpc-client_type"], undefined);
			return JSON.parse(request.body);
		});
		assert.equal(bodies[1].t - bodies[0].t, 13000);
		assert.equal(bodies[2].t - bodies[1].t, 6000);
		for (const body of bodies) {
			assert.deepEqual({ ...body, t: 0 }, {
				t: 0,
				lang: "it",
				game_biz: games[game].gameBiz,
				uid: "synthetic-role",
				region: "prod_official_eur",
				cdkey: code.code,
				platform: "4",
				device_uuid: deviceUuid
			});
		}
	});
}
