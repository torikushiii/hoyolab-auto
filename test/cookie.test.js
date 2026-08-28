const test = require("node:test");
const assert = require("node:assert");

const Cookie = require("../object/cookie.js");

test("splits pairs and trims surrounding whitespace", () => {
	const map = Cookie.parseCookieMap("a=1; b=2");
	assert.deepStrictEqual(map, { a: "1", b: "2" });
});

test("a leading space does not become part of the first key", () => {
	// The 2026-08-28 outage: one leading space in the stored secret made the
	// first key parse as " account_mid_v2", so redemption disabled itself.
	const map = Cookie.parseCookieMap(" account_mid_v2=abc; cookie_token_v2=xyz");
	assert.strictEqual(map.account_mid_v2, "abc");
	assert.ok(!Object.keys(map).some(key => key !== key.trim()), "no key may carry whitespace");
});

test("tolerates missing spaces and trailing separators", () => {
	const map = Cookie.parseCookieMap("a=1;b=2;");
	assert.deepStrictEqual(map, { a: "1", b: "2" });
});

test("keeps values that contain = intact", () => {
	// Base64 values can be padded, and splitting on every = truncates them.
	const map = Cookie.parseCookieMap("token=abc==; other=1");
	assert.strictEqual(map.token, "abc==");
});

test("keeps a value that is itself a token with dots and equals", () => {
	const value = "v2_CAQSDGRuY2k=.yT-Rag.MEUCIQ==";
	const map = Cookie.parseCookieMap(`cookie_token_v2=${value}`);
	assert.strictEqual(map.cookie_token_v2, value);
});

test("a valueless pair yields an empty string, not undefined", () => {
	const map = Cookie.parseCookieMap("flag; a=1");
	assert.strictEqual(map.flag, "");
});

test("missingKeys names absent and empty keys only", () => {
	const map = Cookie.parseCookieMap("ltoken_v2=x; ltuid_v2=; ");
	const missing = Cookie.missingKeys(map, ["ltoken_v2", "ltuid_v2", "ltmid_v2"]);
	assert.deepStrictEqual(missing, ["ltuid_v2", "ltmid_v2"]);
});

test("missingKeys returns empty when everything is present", () => {
	const map = Cookie.parseCookieMap("a=1; b=2");
	assert.deepStrictEqual(Cookie.missingKeys(map, ["a", "b"]), []);
});
