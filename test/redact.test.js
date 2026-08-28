const test = require("node:test");
const assert = require("node:assert");

const { redactUrl, REDACTED } = require("../object/redact.js");

test("removes the Telegram bot token from the path", () => {
	const url = "https://api.telegram.org/bot123456:AAHqwertyuiop/getUpdates";
	const result = redactUrl(url);

	assert.ok(!result.includes("AAHqwertyuiop"), "the token must not survive");
	assert.ok(result.includes("getUpdates"), "the method name is not a secret");
	assert.strictEqual(result, `https://api.telegram.org/bot${REDACTED}/getUpdates`);
});

test("removes a redemption code from the query string", () => {
	const url = "https://sg-hkrpg-api.hoyoverse.com/api?uid=1&cdkey=SECRETCODE&lang=en";
	const result = redactUrl(url);

	assert.ok(!result.includes("SECRETCODE"));
	assert.ok(result.includes("uid=1"), "non-secret params are left alone");
	assert.ok(result.includes("lang=en"));
});

test("redacts token-ish params regardless of case", () => {
	const result = redactUrl("https://example.com/a?Access_Token=abc&x=1");
	assert.ok(!result.includes("abc"));
	assert.ok(result.includes("x=1"));
});

test("leaves a clean url untouched", () => {
	const url = "https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/x?uid=7&region=eur";
	assert.strictEqual(redactUrl(url), url);
});

test("handles null and empty input without throwing", () => {
	assert.strictEqual(redactUrl(null), null);
	assert.strictEqual(redactUrl(""), "");
	assert.strictEqual(redactUrl(undefined), undefined);
});

test("does not throw on a malformed url", () => {
	assert.strictEqual(typeof redactUrl("not a url at all ?cdkey=x"), "string");
});
