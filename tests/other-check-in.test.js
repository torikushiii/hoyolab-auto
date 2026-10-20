const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const HoyoLab = require("../hoyolab-modules/template.js");

// Synthetic fixtures model the captured false -> sign -> true transitions for
// HSR, ZZZ, and HI3. ToT has no captured successful linked-character claim.
const cookie = "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id; ltmid_v2=synthetic-mid";
const awards = [
	{ name: "Synthetic first", cnt: 2, icon: "https://example.invalid/first.png" },
	{ name: "Synthetic last", cnt: 5, icon: "https://example.invalid/last.png" }
];
const info = (signed = false, total = 1) => ({
	body: { retcode: 0, data: { is_sign: signed, total_sign_day: total, today: "2026-09-16" } }
});
const home = () => ({ body: { retcode: 0, data: { awards } } });
const games = [
	["starrail", "starrail", "luna/hkrpg/os", "hkrpg", "e202303301540311"],
	["zenless", "nap", "luna/zzz/os", "zzz", "e202406031448091"],
	["honkai", "honkai", "mani", "bh3", "e202110291205111"],
	["termis", "tot", "luna/nxx/os", "nxx", "e202202281857121"]
];
const confirmedGames = new Set(["starrail", "zenless", "honkai"]);

for (const [folder, platform, route, signgame, actId] of games) {
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
		const Game = require(`../hoyolab-modules/${folder}/index.js`);
		const game = new Game({ id: 1, data: [{ cookie, stamina: { check: false, threshold: 100, persistent: false } }]});
		game.accounts.push({ cookie, uid: "synthetic-role", nickname: "Synthetic player", level: 20, region: "synthetic-region" });
		return { ...harness, game };
	};

	const assertRequests = (requests, paths, language = "en-us") => {
		assert.deepEqual(requests.map(request => request.url.pathname), paths.map(path => `/event/${route}/${path}`));
		for (const request of requests) {
			const signing = request.url.pathname.endsWith("/sign");
			const appRpc = signing && folder !== "honkai";
			assert.equal(request.url.origin, "https://sg-act-public-api.hoyolab.com");
			assert.equal(request.method, signing ? "POST" : "GET");
			assert.deepEqual(Object.fromEntries(request.url.searchParams), signing
				? (folder === "honkai" ? { lang: language } : {})
				: { lang: language, act_id: actId });
			assert.equal(request.headers.cookie, cookie);
			assert.equal(request.headers.origin, "https://act.hoyolab.com");
			assert.equal(request.headers.referer, "https://act.hoyolab.com/");
			assert.equal(request.headers.accept, "application/json, text/plain, */*");
			assert.match(request.headers["user-agent"], /Android.*wv.*miHoYoBBSOversea\/4\.21\.0/);
			assert.equal(request.headers["x-requested-with"], "com.mihoyo.hoyolab");
			assert.equal(request.headers["x-rpc-signgame"], signgame);
			assert.equal(request.headers["x-rpc-client_type"], appRpc ? 5 : undefined);
			assert.equal(request.headers["x-rpc-app_version"], appRpc ? "4.21.0" : undefined);
			assert.equal(request.headers["x-rpc-platform"], appRpc ? 2 : undefined);
			for (const header of ["ds", "x-rpc-language", "x-rpc-lang", "x-rpc-env", "x-rpc-page", "x-rpc-device_id", "x-rpc-device_fp"]) {
				assert.equal(request.headers[header], undefined, header);
			}
			if (signing) {
				assert.deepEqual(JSON.parse(request.body), folder === "honkai" ? { act_id: actId } : { act_id: actId, lang: language });
				assert.equal(request.headers["content-type"], "application/json");
			}
			else {
				assert.equal(request.body, undefined);
			}
		}
	};

	for (const language of [undefined, "it-it"]) {
		test(`${folder}: request contract and synthetic success (${language ?? "default"})`, async (t) => {
			const { game, requests, replies } = await setup(t, language);
			replies.push(info(), home(), { body: { retcode: 0, data: {} } });
			if (confirmedGames.has(folder)) {
				replies.push(info(true, 2));
			}
			assert.deepEqual(await game.checkIn(), [{
				uid: "synthetic-role",
				platform,
				rank: 20,
				username: "Synthetic player",
				region: folder === "termis" ? "Global" : "EU",
				total: 2,
				result: game.config.successMessage,
				assets: { ...game.config.assets, logo: undefined, color: undefined },
				award: { name: awards[1].name, count: awards[1].cnt, icon: awards[1].icon }
			}]);
			assertRequests(requests, ["info", "home", "sign", ...(confirmedGames.has(folder) ? ["info"] : [])], language);
		});
	}

	test(`${folder}: synthetic already-signed final day skips POST and returns the last award`, async (t) => {
		const { game, requests, replies } = await setup(t);
		replies.push(info(true, 2), home());
		const [result] = await game.checkIn();
		assert.equal(result.result, game.config.signedMessage);
		assert.equal(result.total, 2);
		assert.equal(result.award.name, awards[1].name);
		assertRequests(requests, ["info", "home"]);
	});

	for (const stage of ["info", "home", "sign"]) {
		for (const [kind, response] of [
			["no-character retcode", { body: { retcode: -10002, message: "Synthetic missing character", data: null } }],
			["HTTP failure", { statusCode: 403 }]
		]) {
			test(`${folder}: ${stage} ${kind} produces no success`, async (t) => {
				const { game, requests, replies, logs } = await setup(t);
				const paths = ["info"];
				if (stage !== "info") {
					replies.push(info());
					paths.push("home");
				}
				if (stage === "sign") {
					replies.push(home());
					paths.push("sign");
				}
				replies.push(response);
				assert.deepEqual(await game.checkIn(), []);
				assertRequests(requests, paths);
				assert.equal(JSON.stringify(logs).includes("Today's Reward"), false);
			});
		}
	}

	test(`${folder}: no active accounts makes no requests`, async (t) => {
		const { game, requests } = await setup(t);
		game.accounts.length = 0;
		assert.equal(await game.checkIn(), undefined);
		assert.equal(requests.length, 0);
	});

	if (confirmedGames.has(folder)) {
		for (const [name, response] of [
			["unsigned state", info(false, 1)],
			["different date", { body: { retcode: 0, data: { is_sign: true, total_sign_day: 2, today: "2026-09-17" } } }],
			["malformed state", { body: { retcode: 0, data: { is_sign: "true", total_sign_day: 2, today: "2026-09-16" } } }],
			["API failure", { body: { retcode: -1, data: null } }]
		]) {
			test(`${folder}: confirmation ${name} does not report success`, async (t) => {
				const { game, requests, replies } = await setup(t);
				replies.push(info(), home(), { body: { retcode: 0, data: {} } }, response);
				assert.deepEqual(await game.checkIn(), []);
				assertRequests(requests, ["info", "home", "sign", "info"]);
			});
		}
	}
}

test("starrail: captured duplicate-sign retcode is not reported as success", async (t) => {
	const harness = await createHttpHarness(t);
	for (const name of ["info", "warn", "log"]) {
		app.Logger[name] = (...args) => harness.logs.push(args);
	}
	app.HoyoLab = { getRegion: () => "EU" };
	const previousList = [...HoyoLab.list];
	t.after(() => {
		HoyoLab.list = previousList;
	});
	const StarRail = require("../hoyolab-modules/starrail/index.js");
	const game = new StarRail({ id: 1, data: [{ cookie, stamina: { check: false, threshold: 100, persistent: false } }]});
	game.accounts.push({ cookie, uid: "synthetic-role", nickname: "Synthetic player", level: 20, region: "synthetic-region" });
	harness.replies.push(info(), home(), { body: { retcode: -5003, message: "Synthetic already checked in", data: null } });
	assert.deepEqual(await game.checkIn(), []);
	assert.deepEqual(harness.requests.map(request => request.url.pathname), [
		"/event/luna/hkrpg/os/info",
		"/event/luna/hkrpg/os/home",
		"/event/luna/hkrpg/os/sign"
	]);
});
