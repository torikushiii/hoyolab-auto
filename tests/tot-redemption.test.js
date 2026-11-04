const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createRedemptionHarness } = require("./helpers/http.js");
const HoyoLab = require("../hoyolab-modules/template.js");
const TearsOfThemis = require("../hoyolab-modules/termis/index.js");
const { redeemCodes } = require("../crons/code-redeem/tot.js");
const { checkAndRedeem, buildMessage, getRedemptionCookieHash } = require("../crons/code-redeem/utils.js");
const { getPendingCodes } = require("../hoyolab-modules/redemption-request.js");
const { REGION, GAME_BIZ, ROLE_URL, REDEMPTION_URL } = require("../hoyolab-modules/termis/redemption-request.js");
const redeemCommand = require("../commands/redeem/index.js");
const Telegram = require("../platforms/telegram.js");
const Command = require("../classes/command.js");

const cookie = "ltoken_v2=synthetic-token; ltuid_v2=1001; ltmid_v2=synthetic-mid; cookie_token_v2=synthetic-cookie; account_id_v2=1001; account_mid_v2=synthetic-mid";
const account = { uid: "1001", region: "Global", platform: "tot", cookie, redeemCode: true };
const code = { code: "SYNTHETICCODE", rewards: []};
// Same envelope/fields as the captured official role response, with synthetic identity.
const role = { game_biz: GAME_BIZ, region: REGION, game_uid: "2002", nickname: "Synthetic Attorney", level: 1, is_chosen: false, region_name: "Tears of Themis", is_official: true, is_banned: false, unmask: []};
const roleReply = (list = [role]) => ({ body: { retcode: 0, message: "OK", data: { list } } });

const setup = async (t, language) => {
	const harness = await createRedemptionHarness(t, { language });
	app.Error = class extends Error {
		constructor ({ message }) { super(message); }
	};
	for (const name of ["warn", "info", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.HoyoLab.parseCookie = HoyoLab.parseCookie;
	app.HoyoLab.get = () => null;
	app.HoyoLab.getActiveAccounts = ({ whitelist }) => whitelist === "tot" ? [account] : [];
	return harness;
};

for (const [language, full, short] of [[undefined, "en-us", "en"], ["it-it", "it-it", "it"], ["zh-tw", "zh-tw", "zh-tw"]]) {
	test(`ToT gift discovery and redemption use distinct locales (${language ?? "default"})`, async (t) => {
		const harness = await setup(t, language);
		harness.replies.push(roleReply(), { body: { retcode: 0, message: "OK", data: { msg: "Redeemed" } } });
		assert.deepEqual(await redeemCodes(account, code), { success: true });
		assert.equal(harness.requests.length, 2);
		const [discovery, redeem] = harness.requests;
		assert.equal(discovery.url.origin + discovery.url.pathname, ROLE_URL);
		assert.deepEqual(Object.fromEntries(discovery.url.searchParams), {
			t: String(Date.now()), game_biz: GAME_BIZ, region: REGION
		});
		assert.equal(redeem.url.origin + redeem.url.pathname, REDEMPTION_URL);
		assert.deepEqual(Object.fromEntries(redeem.url.searchParams), {
			t: String(Date.now()), lang: short, game_biz: GAME_BIZ, uid: role.game_uid, region: REGION, cdkey: code.code
		});
		assert.equal(discovery.headers["x-rpc-language"], full);
		assert.equal(redeem.headers["x-rpc-language"], short);
		for (const request of harness.requests) {
			assert.equal(request.method, "GET");
			assert.equal(request.body, undefined);
			assert.equal(request.headers.cookie, cookie);
			assert.equal(request.headers.origin, "https://tot.hoyoverse.com");
			assert.equal(request.headers.referer, "https://tot.hoyoverse.com/");
			assert.equal(request.headers.ds, undefined);
			assert.equal(request.headers["x-rpc-client_type"], undefined);
		}
		assert.deepEqual(await getPendingCodes(GAME_BIZ, account), []);
	});
}

for (const list of [[], null, [{}], [{ ...role, region: "wrong-region" }], [{ ...role, game_biz: "wrong-game" }], [{ ...role, game_uid: "" }], [{ ...role, nickname: "" }]]) {
	test(`ToT never uses the HoYoLAB UID when no valid role is linked (${JSON.stringify(list)})`, async (t) => {
		const harness = await setup(t);
		harness.replies.push(roleReply(list));
		assert.match((await redeemCodes(account, code)).reason, /No linked Tears of Themis character/);
		assert.equal(harness.requests.length, 1);
	});
}

test("ToT discovery errors never mark a code expired or completed", async (t) => {
	const harness = await setup(t);
	harness.replies.push({ body: { retcode: -2001, message: "Synthetic discovery failure" } });
	await app.Cache.set({ key: "tot-code", value: ["OLDER"]});
	const result = await checkAndRedeem({ tot: [code]});
	assert.equal(result.failed.length, 1);
	assert.equal(result.failed[0].retcode, undefined);
	assert.equal(harness.cache.has("tot-code:Global:1001"), false);
	assert.deepEqual(harness.cache.get("tot-code"), ["OLDER"]);
});

test("ToT queue retries use the discovered role but persist under the check-in account identity", async (t) => {
	const harness = await setup(t);
	harness.replies.push(roleReply(), { statusCode: 503, body: {} });
	assert.equal((await redeemCodes(account, code)).success, false);
	assert.deepEqual(await getPendingCodes(GAME_BIZ, account), [code.code]);
	harness.replies.push(roleReply(), { body: { retcode: 0 } });
	const result = await checkAndRedeem({ tot: []});
	assert.equal(result.success.length, 1);
	assert.deepEqual(await getPendingCodes(GAME_BIZ, account), []);
	assert.deepEqual(harness.delays, [6000]);
	assert.equal(harness.requests.at(-1).url.searchParams.get("uid"), role.game_uid);
});

for (const retcode of [-2001, -2003, -2006, -2017]) {
	test(`ToT automatic redemption caches final response ${retcode} per account`, async (t) => {
		const harness = await setup(t);
		await app.Cache.set({ key: "tot-code", value: ["OLDER"]});
		harness.replies.push(roleReply(), { body: { retcode, message: "Synthetic final failure" } });
		const result = await checkAndRedeem({ tot: [code]});
		assert.equal(result.failed[0].retcode, retcode);
		assert.deepEqual(harness.cache.get("tot-code:Global:1001"), [code.code]);
		assert.deepEqual(await checkAndRedeem({ tot: [code]}), { success: [], failed: [], manual: []});
		assert.equal(harness.requests.length, 2);
	});
}

for (const enabled of [undefined, false, true]) {
	test(`ToT login loads the character identity and preserves redemption preference ${enabled}`, async (t) => {
		const harness = await setup(t);
		const controller = new TearsOfThemis({ id: 1, data: [{ cookie, ...(enabled !== undefined && { redeemCode: enabled }) }]});
		harness.replies.push(roleReply());
		await controller.login();
		const [loggedIn] = controller.accounts;
		assert.equal(loggedIn.uid, role.game_uid);
		assert.equal(loggedIn.region, REGION);
		assert.equal(loggedIn.nickname, role.nickname);
		assert.equal(loggedIn.ltuid, account.uid);
		assert.equal(loggedIn.redemptionRoleAvailable, true);
		assert.equal(HoyoLab.getRegion(loggedIn.region), "Global");
		assert.equal(loggedIn.redeemCode, enabled);
		app.HoyoLab.getActiveAccounts = ({ whitelist }) => whitelist === "tot" ? [loggedIn] : [];
		await app.Cache.set({ key: "tot-code", value: ["OLDER"]});
		harness.replies.push(roleReply(), { body: { retcode: 0 } });
		const result = await checkAndRedeem({ tot: [code]});
		assert.equal(result.success.length, enabled ? 1 : 0);
		assert.equal(result.manual.length, enabled === undefined ? 1 : 0);
		assert.equal(harness.requests.length, enabled ? 3 : 1);
	});
}

test("ToT missing redemption credentials disable redemption while retaining the configured preference", async (t) => {
	await setup(t);
	const controller = new TearsOfThemis({ id: 1, data: [{ cookie: "ltoken_v2=synthetic; ltuid_v2=1001; ltmid_v2=synthetic", redeemCode: true }]});
	await controller.login();
	assert.equal(controller.accounts[0].redeemCode, false);
	assert.equal(controller.accounts[0].redeemCodeConfigured, true);
	assert.equal(controller.accounts[0].redemptionRoleAvailable, false);
});

test("legacy ToT manual notifications do not suppress another account's failed automatic redemption", async (t) => {
	const harness = await setup(t);
	const legacy = { ...account, uid: "3003", redeemCode: undefined };
	app.HoyoLab.getActiveAccounts = ({ whitelist }) => whitelist === "tot" ? [legacy, account] : [];
	await app.Cache.set({ key: "tot-code", value: ["OLDER"]});
	harness.replies.push(roleReply(), { statusCode: 503, body: {} });
	const first = await checkAndRedeem({ tot: [code]});
	assert.equal(first.manual.length, 1);
	assert.equal(first.failed.length, 1);
	assert.deepEqual(harness.cache.get("tot-code"), ["OLDER"]);
	harness.replies.push(roleReply(), { body: { retcode: 0 } });
	const second = await checkAndRedeem({ tot: [code]});
	assert.equal(second.manual.length, 0);
	assert.equal(second.success.length, 1);
	assert.deepEqual(harness.cache.get("tot-code"), ["OLDER", code.code]);
});

const setupManual = async (t, enabled = true) => {
	const harness = await setup(t);
	const previousList = HoyoLab.list;
	t.after(() => {
		HoyoLab.list = previousList;
	});
	app.HoyoLab = HoyoLab;
	const controller = new TearsOfThemis({ id: 1, data: [{ cookie, ...(enabled !== undefined && { redeemCode: enabled }) }]});
	harness.replies.push(roleReply());
	await controller.login();
	harness.requests.length = 0;
	HoyoLab.list = [controller];
	return { ...harness, controller, loggedIn: controller.accounts[0] };
};

test("manual ToT command dispatches through the real controller and captured gift contract", async (t) => {
	const harness = await setupManual(t);
	harness.replies.push(roleReply(), { body: { retcode: 0 } });
	assert.deepEqual(await redeemCommand.run({}, "tot", role.game_uid, code.code.toLowerCase()), {
		success: true, reply: `Successfully redeemed code: ${code.code}`
	});
	assert.equal(harness.requests.length, 2);
	assert.equal(harness.requests[1].url.searchParams.get("uid"), role.game_uid);
	assert.equal(harness.requests[1].url.searchParams.get("cdkey"), code.code);
	assert.equal(harness.requests[1].headers.ds, undefined);
});

test("Discord offers ToT only in redeem account choices and executes the command", async (t) => {
	const harness = await setupManual(t);
	const data = new Command(redeemCommand).getSlashCommandData().toJSON();
	assert.ok(data.options.find(option => option.name === "game").choices.some(choice => choice.value === "tot"));
	assert.deepEqual(data.options.find(option => option.name === "account").choices.map(choice => choice.value), [role.game_uid]);
	assert.equal(data.options.find(option => option.name === "account").choices[0].name,
		`(Global) ToT - (${role.game_uid}) ${role.nickname}`);
	const notes = new Command(require("../commands/notes/index.js")).getSlashCommandData().toJSON();
	assert.equal(notes.options.some(option => option.name === "account"), false);
	harness.replies.push(roleReply(), { body: { retcode: 0 } });
	const replies = [];
	await redeemCommand.run({ interaction: {
		deferReply: async options => replies.push(options),
		editReply: async message => replies.push(message)
	} }, "tot", role.game_uid, code.code);
	assert.deepEqual(replies, [{ ephemeral: true }, `Successfully redeemed code: ${code.code}`]);
});

for (const [retcode, message] of [[-2001, "Redemption code expired."], [-2017, "Already redeemed"]]) {
	test(`manual ToT command propagates backend failure ${retcode}`, async (t) => {
		const harness = await setupManual(t);
		harness.replies.push(roleReply(), { body: { retcode, message } });
		assert.deepEqual(await redeemCommand.run({}, "tot", role.game_uid, code.code), {
			success: false, reply: `Failed to redeem code: ${message}`
		});
	});
}

test("manual ToT disabled account rejects redemption before any HTTP request", async (t) => {
	const harness = await setupManual(t, false);
	const result = await redeemCommand.run({}, "tot", role.game_uid, code.code);
	assert.equal(result.success, false);
	assert.match(result.reply, /disabled/);
	assert.equal(harness.requests.length, 0);
});

test("manual ToT lookup failure is returned to the command without redemption", async (t) => {
	const harness = await setupManual(t);
	harness.replies.push(roleReply([]));
	const result = await redeemCommand.run({}, "tot", role.game_uid, code.code);
	assert.equal(result.success, false);
	assert.match(result.reply, /No linked Tears of Themis character/);
	assert.equal(harness.requests.length, 1);
});

test("manual ToT login expiration uses the shared cookie-refresh retry", async (t) => {
	const harness = await setupManual(t);
	let refreshes = 0;
	t.mock.method(HoyoLab, "refreshStoredCookies", async currentCookie => {
		assert.equal(currentCookie, harness.loggedIn.cookie);
		refreshes++;
		return true;
	});
	harness.replies.push({ body: { retcode: -100, message: "Please log in" } }, roleReply(), { body: { retcode: 0 } });
	assert.equal((await redeemCommand.run({}, "tot", role.game_uid, code.code)).success, true);
	assert.equal(refreshes, 1);
	assert.equal(harness.requests.length, 3);
});

test("manual ToT temporary failures are retried by the automatic queue with shared cooldown", async (t) => {
	const harness = await setupManual(t);
	harness.replies.push(roleReply(), { statusCode: 503, body: {} });
	assert.equal((await redeemCommand.run({}, "tot", role.game_uid, code.code)).success, false);
	assert.deepEqual(await getPendingCodes(GAME_BIZ, harness.loggedIn), [code.code]);
	harness.replies.push(roleReply(), { body: { retcode: 0 } });
	const result = await checkAndRedeem({ tot: []});
	assert.equal(result.success.length, 1);
	assert.deepEqual(harness.delays, [6000]);
	assert.deepEqual(await getPendingCodes(GAME_BIZ, harness.loggedIn), []);
});

test("Telegram ToT account selection, code input and redemption use the real controller offline", async (t) => {
	const harness = await setupManual(t);
	// Use real conversation methods with simulated delivery/input, without polling Telegram.
	const telegram = Object.create(Telegram.prototype);
	telegram.messageListeners = [];
	const sent = [];
	telegram.send = async (message, options) => sent.push({ message, options });
	await telegram.handleCommand({ command: "redeem", args: []});
	const callback = sent[0].options.reply_markup.inline_keyboard[0][0].callback_data;
	assert.equal(callback, `redeem:tot:${role.game_uid}`);
	assert.equal(sent[0].options.reply_markup.inline_keyboard[0][0].text,
		`(Global) ToT - (${role.game_uid}) ${role.nickname}`);
	harness.replies.push(roleReply(), { body: { retcode: 0 } });
	const completion = telegram.handleMessage({ callback_query: { data: callback, from: { id: 42 } } });
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(telegram.messageListeners.length, 1);
	await telegram.messageListeners[0]({ message: { from: { id: 42 }, text: code.code } });
	await completion;
	assert.equal(sent.at(-1).message, `Successfully redeemed code: ${code.code}`);
	assert.equal(telegram.messageListeners.length, 0);
	assert.equal(telegram.handlingCallbackQuery, false);
	assert.equal(harness.requests[1].url.searchParams.get("uid"), role.game_uid);
});

for (const failure of [roleReply([]), { statusCode: 403, body: {} }, { body: { retcode: -100, message: "Please log in" } }]) {
	test(`ToT discovery failure preserves check-in but omits fictitious game identities (${JSON.stringify(failure)})`, async (t) => {
		const harness = await setup(t);
		const previousList = HoyoLab.list;
		t.after(() => {
			HoyoLab.list = previousList;
		});
		app.HoyoLab = HoyoLab;
		harness.replies.push(failure);
		const controller = new TearsOfThemis({ id: 1, data: [{ cookie, redeemCode: true }]});
		await controller.login();
		HoyoLab.list = [controller];
		assert.equal(controller.accounts[0].redemptionRoleAvailable, false);
		const data = new Command(redeemCommand).getSlashCommandData().toJSON();
		assert.equal(data.options.some(option => option.name === "account"), false);
		const sent = [];
		await Telegram.prototype.handleCommand.call({ send: async message => sent.push(message) }, { command: "redeem" });
		assert.deepEqual(sent, ["There are no accounts available for redeeming codes."]);
		assert.equal((await HoyoLab.redeemCode("tot", account.uid, code.code)).success, false);
		assert.equal(harness.requests.length, 1);
		harness.replies.push(
			{ body: { retcode: 0, data: { is_sign: true, total_sign_day: 1, today: "2026-11-04" } } },
			{ body: { retcode: 0, data: { awards: [{ name: "Synthetic", cnt: 1 }]} } }
		);
		assert.equal((await controller.checkIn()).length, 1);
		assert.deepEqual(harness.requests.slice(1).map(request => request.url.pathname), ["/event/luna/nxx/os/info", "/event/luna/nxx/os/home"]);
	});
}

test("ToT login handles transport failure without blocking check-in account creation", async (t) => {
	await setup(t);
	app.Got = async () => {
		throw new Error("Synthetic network failure");
	};
	const controller = new TearsOfThemis({ id: 1, data: [{ cookie, redeemCode: true }]});
	await controller.login();
	assert.equal(controller.accounts.length, 1);
	assert.equal(controller.accounts[0].redemptionRoleAvailable, false);
});

test("ToT keeps existing completed, pending and login-pause cache keys while reporting the game identity", async (t) => {
	const harness = await setupManual(t);
	await app.Cache.set({ key: "tot-code", value: ["OLDER"]});
	await app.Cache.set({ key: "tot-code:Global:1001", value: [code.code]});
	assert.deepEqual(await checkAndRedeem({ tot: [code]}), { success: [], failed: [], manual: []});
	assert.equal(harness.requests.length, 0);
	await app.Cache.set({ key: "redemption:pending:nxx_global:Global:1001", value: [code.code]});
	assert.deepEqual(await getPendingCodes(GAME_BIZ, harness.loggedIn), [code.code]);
	const cookieHash = getRedemptionCookieHash(harness.loggedIn);
	await app.Cache.set({ key: "tot-code:Global:1001:expired-login", value: cookieHash });
	assert.ok((await checkAndRedeem({ tot: []})).failed.some(entry => entry.loginExpired));
	assert.equal(harness.requests.length, 0);
	await app.Cache.delete("tot-code:Global:1001:expired-login");
	harness.replies.push(roleReply(), { body: { retcode: 0 } });
	const result = await checkAndRedeem({ tot: []});
	assert.equal(result.success[0].account.uid, role.game_uid);
	assert.equal(result.success[0].account.nickname, role.nickname);
	assert.match(buildMessage("success", result.success[0]).telegram, new RegExp(`\\(${role.game_uid}\\) ${role.nickname}`));
	assert.deepEqual(await getPendingCodes(GAME_BIZ, harness.loggedIn), []);
	assert.equal(harness.cache.has(`redemption:pending:${GAME_BIZ}:${REGION}:${role.game_uid}`), false);
});

test("ToT rejects redemption if fresh discovery no longer matches the selected game UID", async (t) => {
	const harness = await setupManual(t);
	harness.replies.push(roleReply([{ ...role, game_uid: "9999" }]));
	const result = await redeemCommand.run({}, "tot", role.game_uid, code.code);
	assert.equal(result.success, false);
	assert.match(result.reply, /character has changed/);
	assert.equal(harness.requests.length, 1);
});

test("ToT check-in retains its cookie-only contract with the discovered game identity", async (t) => {
	const harness = await setupManual(t);
	harness.replies.push(
		{ body: { retcode: 0, data: { is_sign: true, total_sign_day: 1, today: "2026-11-04" } } },
		{ body: { retcode: 0, data: { awards: [{ name: "Synthetic", cnt: 1 }]} } }
	);
	const [result] = await harness.controller.checkIn();
	assert.equal(result.uid, role.game_uid);
	assert.equal(result.username, role.nickname);
	for (const request of harness.requests) {
		assert.equal(request.headers.cookie, harness.loggedIn.cookie);
		assert.equal(request.url.searchParams.get("uid"), null);
		assert.equal(request.url.searchParams.get("region"), null);
		assert.equal(request.headers.ds, undefined);
	}
});
