const test = require("node:test");
const assert = require("node:assert");

const Health = require("../crons/health/index.js");

const PUSH_URL = "https://kuma.example.com/api/push/tok";

/**
 * Stubs the globals the cron reaches for, and records every heartbeat it sends
 * so the decision (up, down, or silence) can be asserted.
 */
const withStubs = ({ accounts, probeResults, pushUrl = PUSH_URL }) => {
	const pushes = [];
	const logs = { error: [], warn: [], debug: [] };
	let queue = [...probeResults];

	globalThis.app = {
		Config: { get: (key) => (key === "health" ? { kumaPushUrl: pushUrl } : undefined) },
		HoyoLab: { getActiveAccounts: () => accounts },
		Logger: {
			error: (_t, m) => logs.error.push(m),
			warn: (_t, m) => logs.warn.push(m),
			info: () => {},
			debug: (_t, m) => logs.debug.push(m)
		},
		Got: async (_name, opts) => {
			pushes.push(opts.url);
			return { statusCode: 200, body: "OK" };
		}
	};

	// The cron calls into the probe module, which we replace wholesale here so
	// the test covers the cron's own decision logic and nothing else.
	const probeModule = require("../object/credential-probe.js");
	probeModule.checkAccount = async () => queue.shift();

	return { pushes, logs };
};

test.afterEach(() => {
	delete globalThis.app;
});

test("pushes up when every credential is healthy", async () => {
	const { pushes } = withStubs({
		accounts: [{ uid: "1", platform: "starrail", cookie: "x" }],
		probeResults: [[
			{ credential: "ltoken_v2", state: "healthy", impact: "check-in" },
			{ credential: "cookie_token_v2", state: "healthy", impact: "redemption" }
		]]
	});

	await Health.code();

	assert.strictEqual(pushes.length, 1);
	assert.ok(pushes[0].includes("status=up"), `expected an up push, got ${pushes[0]}`);
});

test("pushes down and names the credential and the impact", async () => {
	const { pushes, logs } = withStubs({
		accounts: [{ uid: "714798638", platform: "starrail", game: { short: "HSR" }, cookie: "x" }],
		probeResults: [[
			{ credential: "ltoken_v2", state: "healthy", impact: "check-in" },
			{ credential: "cookie_token_v2", state: "dead", impact: "code redemption", detail: "retcode -100" }
		]]
	});

	await Health.code();

	assert.strictEqual(pushes.length, 1);
	// URLSearchParams encodes spaces as "+", which is correct form encoding and
	// is what Kuma decodes. Undo it here so the assertions read naturally.
	const pushed = decodeURIComponent(pushes[0].replace(/\+/g, " "));
	assert.ok(pushed.includes("status=down"), "a dead credential must push down");
	assert.ok(pushed.includes("cookie_token_v2"), "the alert must name the credential");
	assert.ok(pushed.includes("code redemption"), "the alert must say what stops working");
	assert.strictEqual(logs.error.length, 1);
});

test("stays silent when the probe could not decide", async () => {
	// A timeout says nothing about the credential. Sending nothing lets the
	// missed heartbeat speak, which Kuma tolerates for a couple of cycles.
	const { pushes } = withStubs({
		accounts: [{ uid: "1", platform: "starrail", cookie: "x" }],
		probeResults: [[
			{ credential: "ltoken_v2", state: "inconclusive", detail: "timeout" }
		]]
	});

	await Health.code();

	assert.strictEqual(pushes.length, 0, "an undecided probe must not push anything");
});

test("a dead credential outranks an inconclusive one", async () => {
	const { pushes } = withStubs({
		accounts: [{ uid: "1", platform: "starrail", cookie: "x" }],
		probeResults: [[
			{ credential: "ltoken_v2", state: "inconclusive", detail: "timeout" },
			{ credential: "cookie_token_v2", state: "dead", impact: "code redemption", detail: "retcode -100" }
		]]
	});

	await Health.code();

	assert.strictEqual(pushes.length, 1);
	assert.ok(pushes[0].includes("status=down"));
});

test("logs only when no push url is configured", async () => {
	const { pushes, logs } = withStubs({
		accounts: [{ uid: "1", platform: "starrail", cookie: "x" }],
		probeResults: [[{ credential: "cookie_token_v2", state: "dead", impact: "code redemption", detail: "d" }]],
		pushUrl: ""
	});

	await Health.code();

	assert.strictEqual(pushes.length, 0, "an unconfigured url must not be fetched");
	assert.strictEqual(logs.error.length, 1, "the failure is still logged");
});

test("treats an unrendered envsubst placeholder as unconfigured", async () => {
	// If a var is added to the template but not to the Dockerfile's envsubst
	// list, the literal "$KUMA_PUSH_URL" survives into the config.
	const { pushes } = withStubs({
		accounts: [{ uid: "1", platform: "starrail", cookie: "x" }],
		probeResults: [[{ credential: "ltoken_v2", state: "healthy", impact: "check-in" }]],
		pushUrl: "$KUMA_PUSH_URL_HEALTH"
	});

	await Health.code();

	assert.strictEqual(pushes.length, 0);
});
