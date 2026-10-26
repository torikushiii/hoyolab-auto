const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const account = { uid: "123", region: "test", cookie: "test-cookie", redeemCode: true };
const response = (retcode = 0, message = "OK") => ({ statusCode: 200, body: { retcode, message } });
const options = (code, overrides = {}) => ({
	searchParams: { game_biz: "nap_global", ...account, cdkey: code, ...overrides }
});

const harness = (store = new Map()) => {
	let now = 0;
	const calls = [];
	const modules = new Map();
	const state = { respond: async () => response(), accounts: [{ ...account, platform: "nap" }]};
	const app = {
		Cache: {
			get: async key => structuredClone(store.get(key)),
			set: async ({ key, value }) => store.set(key, structuredClone(value)),
			delete: async key => store.delete(key)
		},
		Config: { get: () => "en-us" },
		Error,
		Date,
		Logger: { info () {}, log () {}, debug () {} },
		HoyoLab: {
			parseCookie: () => "test-cookie",
			getActiveAccounts: ({ whitelist } = {}) => state.accounts.filter(acc => !whitelist || acc.platform === whitelist),
			isExpiredLogin: reason => /log in/i.test(reason ?? ""),
			refreshStoredCookies: async () => false
		},
		Utils: { escapeCharacters: value => value },
		Platform: { getForAccount: () => [], getEmbedPlatforms: () => []},
		Got: async (name, data) => {
			if (name === "API") {
				return { statusCode: 200, body: { active: []} };
			}
			calls.push({ at: now, ...data });
			return await state.respond(data);
		}
	};
	const load = (filename) => {
		filename = path.resolve(root, filename);
		if (modules.has(filename)) {
			return modules.get(filename).exports;
		}
		const module = { exports: {} };
		modules.set(filename, module);
		const localRequire = createRequire(filename);
		const requireModule = specifier => {
			if (specifier === "node:timers/promises") {
				return { setTimeout: async ms => {
					now += ms;
				} };
			}
			if (specifier.startsWith(".") && !specifier.includes("localization")) {
				return load(localRequire.resolve(specifier));
			}
			return localRequire(specifier);
		};
		vm.runInNewContext(readFileSync(filename, "utf8"), {
			module,
			require: requireModule,
			app,
			Date: class extends Date { static now () { return now; } }
		}, { filename });
		return module.exports;
	};
	return { load, calls, state, store, request: load("hoyolab-modules/redemption-request.js") };
};

for (const game of ["genshin", "starrail", "zenless"]) {
	test(`${game}: public and reward redemptions use the same queue`, async () => {
		const h = harness();
		const publicCodes = h.load(`crons/code-redeem/${game}.js`);
		const RewardCode = h.load(`hoyolab-modules/${game}/redeem-code.js`);
		const rewardCodes = new RewardCode({ config: { url: { redemption: "https://example.test/redeem" } } });
		await Promise.all([
			publicCodes.redeemCodes(account, { code: "PUBLIC" }),
			rewardCodes.redeemCode(account, "REWARD")
		]);
		assert.equal(h.calls.length, 2);
		assert.equal(h.calls[1].searchParams.cdkey, "REWARD");
		assert.ok(h.calls[1].at - h.calls[0].at >= 6000);
		assert.equal(h.calls[0].searchParams.game_biz, h.calls[1].searchParams.game_biz);
	});
}

test("waits for HoYo's cooldown before retrying and before the next queued code", async () => {
	const h = harness();
	h.state.respond = async () => h.calls.length === 1
		? response(-2016, "Redemption in cooldown. Please try again in 12 seconds.")
		: response();
	await Promise.all([h.request(options("FIRST")), h.request(options("SECOND"))]);
	assert.deepEqual(h.calls.map(call => call.searchParams.cdkey), ["FIRST", "FIRST", "SECOND"]);
	assert.deepEqual(h.calls.map(call => call.at), [0, 13000, 19000]);
});

test("a blocked account does not block a different UID, region or game", async () => {
	const h = harness();
	let release;
	const blocked = new Promise(resolve => {
		release = resolve;
	});
	h.state.respond = async data => data.searchParams.cdkey === "BLOCKED" ? await blocked : response();
	const first = h.request(options("BLOCKED"));
	await Promise.all([
		h.request(options("OTHER_UID", { uid: "456" })),
		h.request(options("OTHER_REGION", { region: "other" })),
		h.request(options("OTHER_GAME", { game_biz: "hkrpg_global" }))
	]);
	assert.equal(h.calls.length, 4);
	assert.ok(h.calls.every(call => call.at === 0));
	release(response());
	await first;
});

test("exhausted cooldown retries survive restart and redeem without new public codes", async () => {
	const h = harness();
	h.state.respond = async () => response(-2016, "Redemption in cooldown");
	const failed = await h.request(options("REWARD"), { persist: true });
	assert.equal(failed.body.retcode, -2016);
	assert.equal(h.calls.length, 3);
	assert.deepEqual(h.calls.map(call => call.at), [0, 6000, 12000]);
	const restarted = harness(h.store);
	const cron = restarted.load("crons/code-redeem/utils.js");
	const result = await cron.checkAndRedeem({});
	assert.equal(result.success.length, 1);
	assert.equal(result.success[0].code.code, "REWARD");
	assert.equal(restarted.calls.length, 1);
	assert.equal((await restarted.request.getPendingCodes("nap_global", account)).length, 0);
});

test("a request exception keeps its code and releases the queue", async () => {
	const h = harness();
	h.state.respond = async () => {
		if (h.calls.length === 1) {
			throw new Error("Connection reset");
		}
		return response();
	};
	const first = h.request(options("REWARD"), { persist: true });
	const second = h.request(options("NEXT"));
	await assert.rejects(first, /Connection reset/);
	await second;
	assert.ok(h.calls[1].at >= 6000);
	assert.deepEqual(Array.from(await h.request.getPendingCodes("nap_global", account)), ["REWARD"]);
});

test("the scheduled job retries saved codes when every public feed is empty", async () => {
	const h = harness();
	h.state.respond = async () => ({ statusCode: 502 });
	await h.request(options("REWARD"), { persist: true });
	h.state.respond = async () => response();
	await h.load("crons/code-redeem/index.js").code();
	assert.equal(h.calls.length, 2);
	assert.equal(h.calls[1].searchParams.cdkey, "REWARD");
	assert.equal((await h.request.getPendingCodes("nap_global", account)).length, 0);
});

test("reward codes are saved while waiting behind another request", async () => {
	const h = harness();
	let release;
	const blocked = new Promise(resolve => {
		release = resolve;
	});
	h.state.respond = async data => data.searchParams.cdkey === "FIRST" ? await blocked : response();
	const first = h.request(options("FIRST"), { persist: true });
	const second = h.request(options("SECOND"), { persist: true });
	let pending = [];
	for (let attempt = 0; attempt < 20; attempt++) {
		pending = Array.from(await h.request.getPendingCodes("nap_global", account));
		if (pending.length === 2 && h.calls.length === 1) {
			break;
		}
	}
	assert.deepEqual(pending, ["FIRST", "SECOND"]);
	assert.equal(h.calls.length, 1);
	release(response());
	await Promise.all([first, second]);
	assert.equal((await h.request.getPendingCodes("nap_global", account)).length, 0);
});

test("pending codes are deduplicated against the public feed and respect redeemCode", async () => {
	const h = harness();
	h.state.respond = async () => ({ statusCode: 502, body: "Bad gateway" });
	await h.request(options("REWARD"), { persist: true });
	const cron = h.load("crons/code-redeem/utils.js");
	h.state.accounts[0].redeemCode = false;
	await cron.checkAndRedeem({ zenless: [{ code: "REWARD" }]});
	assert.equal(h.calls.length, 1);
	h.state.accounts[0].redeemCode = true;
	h.state.respond = async () => response();
	await cron.checkAndRedeem({ zenless: [{ code: "reward" }]});
	assert.equal(h.calls.length, 2);
	assert.equal((await h.request.getPendingCodes("nap_global", account)).length, 0);
});

for (const [retcode, message, kept] of [
	[0, "OK", false],
	[-2001, "Expired", false],
	[-2003, "Invalid", false],
	[-2006, "Usage limit", false],
	[-2017, "Already used", false],
	[-2011, "Level too low", false],
	[-1048, "API system is busy, please try again later.", true],
	[-1071, "Not logged in", true],
	[-100, "Please log in", true]
]) {
	test(`pending code handling for retcode ${retcode}`, async () => {
		const h = harness();
		h.state.respond = async () => response(retcode, message);
		await h.request(options("REWARD"), { persist: true });
		assert.equal(h.calls.length, 1);
		assert.equal((await h.request.getPendingCodes("nap_global", account)).length, kept ? 1 : 0);
	});
}

test("server-busy reward codes stay pending until a later run succeeds", async () => {
	const h = harness();
	h.state.respond = async () => response(-1048, "API system is busy, please try again later.");
	await h.request(options("REWARD"), { persist: true });
	const cron = h.load("crons/code-redeem/utils.js");
	const failed = await cron.checkAndRedeem({});
	assert.equal(failed.failed.length, 1);
	assert.equal((await h.request.getPendingCodes("nap_global", account)).length, 1);
	h.state.respond = async () => response();
	const retried = await cron.checkAndRedeem({});
	assert.equal(retried.success.length, 1);
	assert.equal(h.calls.length, 3);
	assert.equal((await h.request.getPendingCodes("nap_global", account)).length, 0);
});

test("permanently failed saved codes are not retried by later runs", async () => {
	const h = harness();
	h.state.respond = async () => ({ statusCode: 502 });
	await h.request(options("REWARD"), { persist: true });
	const cron = h.load("crons/code-redeem/utils.js");
	h.state.respond = async () => response(-2011, "Level too low");
	await cron.checkAndRedeem({});
	await cron.checkAndRedeem({});
	assert.equal(h.calls.length, 2);
	assert.equal((await h.request.getPendingCodes("nap_global", account)).length, 0);
});

test("the scheduled job skips a saved code that another request redeems first", async () => {
	const h = harness();
	let release;
	const blocked = new Promise(resolve => {
		release = resolve;
	});
	h.state.respond = async () => await blocked;
	const reward = h.request(options("REWARD"), { persist: true });
	while ((await h.request.getPendingCodes("nap_global", account)).length === 0) {
		await new Promise(resolve => setImmediate(resolve));
	}
	const run = h.load("crons/code-redeem/utils.js").checkAndRedeem({});
	release(response());
	await reward;
	const result = await run;
	assert.equal(h.calls.length, 1);
	assert.equal(result.success.length, 0);
	assert.equal(result.failed.length, 0);
});
