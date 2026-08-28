const test = require("node:test");
const assert = require("node:assert");

const Probe = require("../object/credential-probe.js");
const Cookie = require("../object/cookie.js");

test("classifies retcode 0 as healthy", () => {
	const result = Probe.classify({ ok: true, statusCode: 200, body: { retcode: 0, message: "OK" } });
	assert.strictEqual(result.state, "healthy");
});

test("classifies a dead credential and keeps the reason", () => {
	const result = Probe.classify({
		ok: true,
		statusCode: 200,
		body: { retcode: -100, message: "Login status is invalid. Please log in again." }
	});

	assert.strictEqual(result.state, "dead");
	assert.match(result.detail, /-100/);
	assert.match(result.detail, /Login status is invalid/);
});

test("an unrecognised non-zero retcode reads as dead, not as fine", () => {
	// Judging on the success condition means a code nobody has seen before still
	// raises an alert.
	const result = Probe.classify({ ok: true, statusCode: 200, body: { retcode: -9999, message: "brand new failure" } });
	assert.strictEqual(result.state, "dead");
});

test("a transport failure is inconclusive, never dead", () => {
	// Reporting an instrument fault as a dead credential sends the reader to fix
	// something that was never broken.
	assert.strictEqual(Probe.classify({ ok: false }).state, "inconclusive");
});

test("a non-200 response is inconclusive", () => {
	assert.strictEqual(Probe.classify({ ok: true, statusCode: 502, body: null }).state, "inconclusive");
});

test("a body with no retcode is inconclusive", () => {
	assert.strictEqual(Probe.classify({ ok: true, statusCode: 200, body: { message: "hi" } }).state, "inconclusive");
});

test("each probe is sent only its own credential class", () => {
	// verifyLToken accepts a cookie_token and returns OK, so sending the whole
	// cookie would report health that was never tested.
	const map = Cookie.parseCookieMap([
		"ltoken_v2=lt", "ltuid_v2=lu", "ltmid_v2=lm",
		"cookie_token_v2=ct", "account_mid_v2=am", "account_id_v2=ai",
		"ma_passport_region=EU"
	].join("; "));

	const ltokenPairs = Probe.buildPairs(map, Probe.LTOKEN_FIELDS);
	assert.ok(!ltokenPairs.includes("cookie_token_v2"), "ltoken probe must not carry the redemption token");

	const cookieTokenPairs = Probe.buildPairs(map, Probe.COOKIE_TOKEN_FIELDS);
	assert.ok(!cookieTokenPairs.includes("ltoken_v2"), "redemption probe must not carry the login token");
});

test("picks the passport host from the cookie's region", () => {
	assert.strictEqual(Probe.passportHost({ ma_passport_region: "EU" }), Probe.PASSPORT_HOSTS.EU);
	assert.strictEqual(Probe.passportHost({ ma_passport_region: "us" }), Probe.PASSPORT_HOSTS.US);
});

test("falls back to a known-good host when the region is absent or unknown", () => {
	assert.strictEqual(Probe.passportHost({}), Probe.DEFAULT_PASSPORT_HOST);
	assert.strictEqual(Probe.passportHost({ ma_passport_region: "MARS" }), Probe.DEFAULT_PASSPORT_HOST);
});

test("a cookie with no redemption fields reports dead without probing", async () => {
	// This is the state a silently-disabled redemption leaves behind.
	const account = { cookie: "ltoken_v2=lt; ltuid_v2=lu; ltmid_v2=lm", uid: "1", platform: "starrail" };

	globalThis.app = {
		Got: async () => ({ statusCode: 200, body: { retcode: 0, message: "OK" } })
	};

	const findings = await Probe.checkAccount(account);
	const redemption = findings.find(f => f.credential === "cookie_token_v2");

	assert.strictEqual(redemption.state, "dead");
	assert.match(redemption.detail, /cookie_token_v2/);
	assert.match(redemption.impact, /redemption/);

	delete globalThis.app;
});
