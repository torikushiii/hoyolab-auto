const assert = require("node:assert/strict");
const { test } = require("node:test");
const timers = require("node:timers/promises");
const { createHttpHarness } = require("./helpers/http.js");
const Genshin = require("../hoyolab-modules/genshin/index.js");
const { REDEMPTION_URL } = require("../hoyolab-modules/genshin/redemption-request.js");
const HoyoLab = require("../hoyolab-modules/template.js");
const { redeemCodes } = require("../crons/code-redeem/genshin.js");

// Browser request contracts and return/cache regression coverage; no live requests.
const account = {
	uid: "synthetic-role",
	nickname: "Synthetic Traveler",
	region: "os_euro",
	platform: "genshin",
	redeemCode: true,
	cookie: "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id; ltmid_v2=synthetic-mid; cookie_token_v2=synthetic-cookie-token; account_mid_v2=synthetic-account-mid; account_id_v2=synthetic-account-id"
};
const code = { code: "SYNTHETICCODE", rewards: ["Synthetic reward"]};

const setup = async (t, language) => {
	const harness = await createHttpHarness(t, { language });
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.Error = class extends Error {
		constructor ({ message }) { super(message); }
	};
	app.HoyoLab = {
		parseCookie: HoyoLab.parseCookie,
		errorMessage: HoyoLab.errorMessage,
		getActiveAccounts: ({ whitelist }) => whitelist === "genshin" ? [account] : [],
		isExpiredLogin: () => false
	};
	const module = {
		redeemCode: (data, value) => Genshin.prototype.redeemCode.call({
			name: "genshin",
			fullName: "Genshin Impact",
			config: { url: { redemption: REDEMPTION_URL } }
		}, data, value)
	};
	return { ...harness, module };
};

for (const caller of ["module", "cron"]) {
	const invoke = ({ module }) => caller === "module"
		? module.redeemCode(account, code.code)
		: redeemCodes(account, code);

	for (const language of [undefined, "it-it"]) {
		test(`${caller} uses the browser redemption contract (${language ?? "default"})`, async (t) => {
			const harness = await setup(t, language);
			harness.replies.push({ body: { retcode: 0 } });
			assert.equal((await invoke(harness)).success, true);
			assert.equal(harness.requests.length, 1);
			const [request] = harness.requests;
			assert.equal(request.url.origin, "https://public-operation-hk4e.hoyoverse.com");
			assert.equal(request.url.pathname, "/common/apicdkey/api/webExchangeCdkey");
			assert.equal(request.method, "GET");
			assert.equal(request.body, undefined);
			assert.deepEqual(Object.fromEntries(request.url.searchParams), {
				uid: account.uid,
				region: account.region,
				lang: language ? "it" : "en",
				cdkey: code.code,
				game_biz: "hk4e_global",
				sLangKey: "en-us"
			});
			assert.equal(request.headers.cookie, account.cookie);
			assert.equal(request.headers.origin, "https://genshin.hoyoverse.com");
			assert.equal(request.headers.referer, "https://genshin.hoyoverse.com/");
			assert.equal(request.headers.accept, "application/json, text/plain, */*");
			assert.match(request.headers["user-agent"], /Mozilla.*Chrome/);
			assert.equal(request.headers.ds, undefined);
			assert.equal(request.headers["x-requested-with"], undefined);
			assert.deepEqual(Object.keys(request.headers).filter(key => key.startsWith("x-rpc-")), []);
		});
	}

	test(`${caller} redemption preserves its success result`, async (t) => {
		const harness = await setup(t);
		harness.replies.push({ body: { retcode: 0, message: "OK", data: { msg: "Codice riscattato" } } });
		assert.deepEqual(await invoke(harness), caller === "module"
			? { success: true, message: "Code redeemed successfully!" }
			: { success: true });
		assert.equal(harness.requests.length, 1);
		assert.ok(!JSON.stringify(harness.logs).includes("synthetic-token"));
	});

	for (const retcode of [-2011, -2001, -2003, -9999]) {
		test(`${caller} redemption preserves failure ${retcode}`, async (t) => {
			const harness = await setup(t);
			const message = "Synthetic API failure";
			harness.replies.push({ body: { retcode, message } });
			assert.deepEqual(await invoke(harness), caller === "module"
				? { success: false, message }
				: { success: false, reason: [-2001, -2003].includes(retcode) ? "Expired or invalid code" : message, retcode });
			assert.equal(harness.requests.length, 1);
		});
	}

	test(`${caller} redemption preserves HTTP failure behavior`, async (t) => {
		const harness = await setup(t);
		harness.replies.push({ statusCode: 503, body: { message: "Synthetic outage" } });
		if (caller === "module") {
			assert.deepEqual(await invoke(harness), { success: false });
		}
		else {
			await assert.rejects(invoke(harness), /API returned non-200 status code/);
		}
		assert.equal(harness.requests.length, 1);
	});
}

const setupCache = async (t, initial = ["PREVIOUSCODE"]) => {
	const harness = await setup(t);
	const cache = new Map(initial ? [["genshin-code", initial]] : []);
	app.Cache = {
		get: async (key) => structuredClone(cache.get(key)),
		set: async ({ key, value }) => cache.set(key, structuredClone(value))
	};
	const delays = [];
	t.mock.method(timers, "setTimeout", async (ms) => delays.push(ms));
	const utilsPath = require.resolve("../crons/code-redeem/utils.js");
	delete require.cache[utilsPath];
	t.after(() => {
		delete require.cache[utilsPath];
	});
	const { checkAndRedeem } = require(utilsPath);
	return { ...harness, cache, delays, checkAndRedeem };
};

test("cron seeds an empty code cache without redemption", async (t) => {
	const { checkAndRedeem, cache, requests } = await setupCache(t, null);
	assert.equal(await checkAndRedeem({ genshin: [code]}), undefined);
	assert.deepEqual(cache.get("genshin-code"), [code.code]);
	assert.equal(requests.length, 0);
});

for (const retcode of [0, -2011]) {
	test(`cron preserves result grouping, delay and deduplication (${retcode})`, async (t) => {
		const { checkAndRedeem, replies, requests, delays, cache } = await setupCache(t);
		replies.push({ body: { retcode, message: "Synthetic result" } });
		const result = await checkAndRedeem({ genshin: [code]});
		const expectedFailed = retcode === 0
			? []
			: [{
				account,
				code,
				notificationKey: `genshin-code:${account.region}:${account.uid}:failed:${code.code}`,
				reason: "Synthetic result",
				retcode
			}];
		assert.deepEqual(result, {
			success: retcode === 0 ? [{ account, code }] : [],
			failed: expectedFailed,
			manual: []
		});
		assert.deepEqual(cache.get("genshin-code"), retcode === 0 ? ["PREVIOUSCODE", code.code] : ["PREVIOUSCODE"]);
		assert.deepEqual(delays, [6000]);
		if (retcode === 0) {
			assert.equal(await checkAndRedeem({ genshin: [{ ...code, code: code.code.toLowerCase() }]}), undefined);
			assert.equal(requests.length, 1);
		}
		else {
			replies.push({ body: { retcode: 0, message: "Synthetic retry success" } });
			assert.deepEqual(await checkAndRedeem({ genshin: [{ ...code, code: code.code.toLowerCase() }]}), {
				success: [{ account, code: { ...code, code: code.code.toLowerCase() } }],
				failed: [],
				manual: []
			});
			assert.equal(requests.length, 2);
		}
	});
}

test("cron HTTP failure does not cache the pending code", async (t) => {
	const { checkAndRedeem, replies, cache, delays } = await setupCache(t);
	replies.push({ statusCode: 503 });
	assert.deepEqual(await checkAndRedeem({ genshin: [code]}), {
		success: [],
		failed: [{
			account,
			code,
			notificationKey: `genshin-code:${account.region}:${account.uid}:failed:${code.code}`,
			reason: "Redemption request failed; will retry on the next run.",
			retcode: undefined
		}],
		manual: []
	});
	assert.deepEqual(cache.get("genshin-code"), ["PREVIOUSCODE"]);
	assert.deepEqual(delays, [6000]);
});
