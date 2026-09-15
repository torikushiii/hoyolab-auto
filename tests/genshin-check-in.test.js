const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const Genshin = require("../hoyolab-modules/genshin/index.js");
const HoyoLab = require("../hoyolab-modules/template.js");

const cookie = "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id; ltmid_v2=synthetic-mid";
const awards = [
	{ name: "Synthetic first reward", cnt: 2, icon: "https://example.invalid/first.png" },
	{ name: "Synthetic last reward", cnt: 5, icon: "https://example.invalid/last.png" }
];
const info = (signed = false, total = 1, today = "2026-09-15") => ({
	body: { retcode: 0, data: { is_sign: signed, total_sign_day: total, today } }
});
const home = () => ({ body: { retcode: 0, data: { awards } } });
const claim = () => ({ body: { retcode: 0, data: {} } });

const setup = async (t, language) => {
	const harness = await createHttpHarness(t, { language });
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.HoyoLab = { getRegion: () => "EU" };
	const previousList = [...HoyoLab.list];
	t.after(() => {
		HoyoLab.list = previousList;
	});
	const game = new Genshin({ id: 1, data: [{ cookie, stamina: { check: false, threshold: 100, persistent: false } }]});
	game.accounts.push({ cookie, uid: "synthetic-role", nickname: "Synthetic Traveler", level: 20, region: "os_euro" });
	harness.logs.length = 0;
	return { ...harness, game };
};

const assertRequests = (requests, paths, language = "en-us") => {
	assert.deepEqual(requests.map(request => request.url.pathname), paths.map(path => `/event/sol/${path}`));
	for (const request of requests) {
		const signing = request.url.pathname.endsWith("/sign");
		assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
		assert.equal(request.method, signing ? "POST" : "GET");
		assert.deepEqual(Object.fromEntries(request.url.searchParams), signing
			? { lang: language }
			: { lang: language, act_id: "e202102251931481" });
		assert.equal(request.headers.cookie, cookie);
		assert.equal(request.headers.origin, "https://act.hoyolab.com");
		assert.equal(request.headers.referer, "https://act.hoyolab.com/");
		assert.match(request.headers["user-agent"], /Windows NT/);
		assert.equal(request.headers["x-rpc-signgame"], signing ? "hk4e" : undefined);
		assert.equal(request.headers["x-rpc-platform"], signing ? "4" : undefined);
		for (const header of ["ds", "x-rpc-client_type", "x-rpc-app_version", "x-rpc-language", "x-rpc-lang", "x-rpc-env", "x-rpc-page", "x-rpc-device_id", "x-rpc-device_fp", "x-requested-with"]) {
			assert.equal(request.headers[header], undefined, header);
		}
		if (signing) {
			assert.equal(request.body, "{\"act_id\":\"e202102251931481\"}");
			assert.equal(request.headers["content-type"], "application/json");
		}
		else {
			assert.equal(request.body, undefined);
		}
	}
};

for (const language of [undefined, "it-it"]) {
	test(`Genshin confirms the claim and preserves notification fields (${language ?? "default"})`, async (t) => {
		const { game, requests, replies } = await setup(t, language);
		replies.push(info(), home(), claim(), info(true, 2));
		assert.deepEqual(await game.checkIn(), [{
			uid: "synthetic-role",
			platform: "genshin",
			rank: 20,
			username: "Synthetic Traveler",
			region: "EU",
			total: 2,
			result: game.config.successMessage,
			assets: { ...game.config.assets, logo: undefined, color: undefined },
			award: { name: awards[1].name, count: awards[1].cnt, icon: awards[1].icon }
		}]);
		assertRequests(requests, ["info", "home", "sign", "info"], language);
	});
}

test("already signed on the final reward day skips the claim and returns today's reward", async (t) => {
	const { game, requests, replies } = await setup(t);
	replies.push(info(true, 2), home());
	const [result] = await game.checkIn();
	assert.equal(result.result, game.config.signedMessage);
	assert.equal(result.total, 2);
	assert.equal(result.award.name, awards[1].name);
	assertRequests(requests, ["info", "home"]);
});

for (const [name, response] of [
	["claim retcode", { body: { retcode: -10002 } }],
	["claim HTTP error", { statusCode: 403 }]
]) {
	test(`${name} does not produce success or request confirmation`, async (t) => {
		const { game, requests, replies } = await setup(t);
		replies.push(info(), home(), response);
		assert.deepEqual(await game.checkIn(), []);
		assertRequests(requests, ["info", "home", "sign"]);
	});
}

for (const [name, response] of [
	["unsigned", info(false)],
	["retcode error", { body: { retcode: -1 } }],
	["HTTP error", { statusCode: 403 }],
	["missing data", { body: { retcode: 0 } }],
	["non-boolean sign state", info("true", 2)],
	["invalid total", info(true, -1)],
	["different day", info(true, 2, "2026-09-16")]
]) {
	test(`confirmation ${name} never reports a successful claim`, async (t) => {
		const { game, requests, replies, logs } = await setup(t);
		replies.push(info(), home(), claim(), response);
		assert.deepEqual(await game.checkIn(), []);
		assertRequests(requests, ["info", "home", "sign", "info"]);
		assert.equal(JSON.stringify(logs).includes("Today's Reward"), false);
	});
}

test("failed pre-check does not attempt the claim", async (t) => {
	const { game, requests, replies } = await setup(t);
	replies.push({ body: { retcode: -1 } });
	assert.deepEqual(await game.checkIn(), []);
	assertRequests(requests, ["info"]);
});

test("a later invocation rechecks a claim whose confirmation failed without claiming twice", async (t) => {
	const { game, requests, replies } = await setup(t);
	replies.push(info(), home(), claim(), { body: { retcode: -1 } }, info(true, 2), home());
	assert.deepEqual(await game.checkIn(), []);
	const [result] = await game.checkIn();
	assert.equal(result.result, game.config.signedMessage);
	assertRequests(requests, ["info", "home", "sign", "info", "info", "home"]);
});
