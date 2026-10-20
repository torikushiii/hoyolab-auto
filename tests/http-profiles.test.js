const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHttpHarness } = require("./helpers/http.js");
const { getLanguage, getLanguageOnly } = require("../gots/hoyolab-contexts/language.js");

const profiles = [
	"HoYoLabDesktopWeb",
	"HoYoLabAppWebView",
	"HoYoLabGameRecordDesktopWeb",
	"HoYoLabGameRecordAppWebView",
	"HoYoLabNative",
	"HoYoLabZZZGameRecordAppWebView",
	"HoYoLabHSRGameRecordDesktopWeb",
	"HoYoLabHI3GameRecordDesktopWeb"
];
const url = "https://example.invalid/event/contract";

const assertAbsent = (headers, names) => {
	for (const name of names) {
		assert.equal(headers[name], undefined, `Unexpected header: ${name}`);
	}
};

test("real Got serialization and synthetic responses work without network", async (t) => {
	const { Got, requests, replies } = await createHttpHarness(t);
	replies.push({ body: { retcode: -10002, message: "Synthetic eligibility error" } });
	const response = await Got("HoYoLabDesktopWeb", {
		url,
		method: "POST",
		searchParams: { lang: getLanguage(), sample: "a b&c" },
		json: { act_id: "synthetic-act" },
		headers: { Cookie: "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id" }
	});
	assert.equal(response.body.retcode, -10002);
	assert.equal(requests.length, 1);
	const [request] = requests;
	assert.equal(request.url.origin, "https://example.invalid");
	assert.equal(request.url.pathname, "/event/contract");
	assert.equal(request.method, "POST");
	assert.deepEqual([...request.url.searchParams], [["lang", "en-us"], ["sample", "a b&c"]]);
	assert.equal(request.body, "{\"act_id\":\"synthetic-act\"}");
	assert.equal(request.headers["content-type"], "application/json");
	assert.equal(Number(request.headers["content-length"]), Buffer.byteLength(request.body));
	assert.equal(request.headers.cookie, "ltoken_v2=synthetic-token; ltuid_v2=synthetic-id");
});

test("capture observes endpoint hooks after inherited hooks and JSON serialization", async (t) => {
	const { Got, requests } = await createHttpHarness(t);
	await Got("HoYoLabNative", {
		url,
		method: "POST",
		json: { value: "synthetic" },
		hooks: {
			beforeRequest: [(options) => {
				assert.equal(typeof options.body, "string");
				options.headers.ds = `synthetic-signature-${options.body.length}`;
				options.url.searchParams.set("lang", "it");
			}]
		}
	});
	assert.equal(requests[0].headers.ds, `synthetic-signature-${requests[0].body.length}`);
	assert.equal(requests[0].url.searchParams.get("lang"), "it");
});

test("contexts retain Global transport, configured retry, timeout and logging hooks", async (t) => {
	const { Got, requests, logs } = await createHttpHarness(t, {
		userAgent: "synthetic-global-agent",
		retry: { attempts: 2, delayMs: 17, timeoutMs: 1234 }
	});
	for (const profile of [...profiles, "HoYoLabPassport"]) {
		await Got(profile, { url });
	}
	for (const { transport } of requests) {
		assert.equal(transport.http2, true);
		assert.equal(transport.responseType, "json");
		assert.equal(transport.throwHttpErrors, false);
		assert.equal(transport.timeout.request, 1234);
		assert.equal(transport.retry.limit, 2);
		assert.equal(transport.retry.calculateDelay({ computedValue: 0 }), 0);
		assert.equal(transport.retry.calculateDelay({ computedValue: 100 }), 17);
		assert.equal(transport.beforeError.length, 1);
	}
	const error = new Error("Synthetic transport error");
	error.options = { method: "GET", url: new URL(url) };
	assert.equal(await requests[0].transport.beforeError[0](error), error);
	assert.equal(logs.length, 2);
});

test("desktop, WebView, Game Record and native identities remain distinct", async (t) => {
	const { Got, requests } = await createHttpHarness(t);
	for (const profile of profiles) {
		await Got(profile, { url });
	}
	const [desktop, webview, recordDesktop, recordWebview, native, zzz] = requests.map((request) => request.headers);
	for (const headers of [desktop, webview]) {
		assert.equal(Object.keys(headers).some((name) => name.startsWith("x-rpc-")), false);
	}
	assert.match(desktop["user-agent"], /Windows NT/);
	assertAbsent(desktop, ["x-requested-with"]);
	assert.match(webview["user-agent"], /wv\).*miHoYoBBSOversea\/4\.20\.0/);
	assert.equal(webview["x-requested-with"], "com.mihoyo.hoyolab");
	assert.equal(recordDesktop["user-agent"], desktop["user-agent"]);
	assert.equal(recordDesktop["x-rpc-app_version"], "1.5.0");
	assert.equal(String(recordDesktop["x-rpc-platform"]), "4");
	assert.equal(recordWebview["user-agent"], webview["user-agent"]);
	assert.equal(recordWebview["x-rpc-app_version"], "4.20.0");
	assert.equal(String(recordWebview["x-rpc-platform"]), "2");
	for (const headers of [recordDesktop, recordWebview]) {
		assert.equal(String(headers["x-rpc-client_type"]), "5");
		assert.equal(headers["x-rpc-env"], "default");
	}
	for (const headers of [desktop, webview, recordDesktop, recordWebview]) {
		assert.equal(headers.origin, "https://act.hoyolab.com");
		assert.equal(headers.referer, "https://act.hoyolab.com/");
	}
	assert.equal(zzz["user-agent"], webview["user-agent"]);
	assert.equal(zzz["x-rpc-app_version"], "4.20.0");
	assert.equal(String(zzz["x-rpc-platform"]), "2");
	assertAbsent(zzz, ["x-rpc-client_type", "x-rpc-env"]);
	assert.equal(native["user-agent"], "okhttp/4.12.0");
	assert.equal(native.referer, "https://app.hoyolab.com");
	assert.equal(String(native["x-rpc-client_type"]), "2");
	assert.equal(native["x-rpc-app_version"], recordWebview["x-rpc-app_version"]);
	assertAbsent(native, ["origin", "x-requested-with", "x-rpc-platform", "x-rpc-lang", "x-rpc-env"]);
	for (const { headers, url: requestUrl, body, transport } of requests) {
		assertAbsent(headers, ["ds", "cookie", "x-rpc-page", "x-rpc-device_id", "x-rpc-device_fp", "x-rpc-signgame"]);
		assert.equal(requestUrl.search, "");
		assert.equal(body, undefined);
		assert.equal(transport.retry.limit, 0);
		assert.equal(transport.timeout.request, 30000);
	}
});

for (const [language, full, short] of [
	[undefined, "en-us", "en"],
	["", "en-us", "en"],
	["it-it", "it-it", "it"],
	["future-region", "future-region", "future"],
	["ja", "ja", "ja"]
]) {
	test(`locale serialization preserves configuration: ${String(language)}`, async (t) => {
		const config = { language };
		const { Got, requests } = await createHttpHarness(t, config);
		for (const profile of profiles) {
			await Got(profile, {
				url,
				searchParams: { lang: profile === "HoYoLabNative" ? getLanguageOnly() : getLanguage() }
			});
		}
		for (const [index, { headers, url: requestUrl }] of requests.entries()) {
			assert.equal(requestUrl.searchParams.get("lang"), index === 4 ? short : full);
			assert.equal(headers["x-rpc-language"], index >= 2 ? full : undefined);
			assert.equal(headers["x-rpc-lang"], index === 2 || index === 3 || index === 5 ? full : undefined);
		}
		assert.equal(config.language, language);
	});
}

test("DS and endpoint headers are opt-in and do not leak across requests or profiles", async (t) => {
	const { Got, requests } = await createHttpHarness(t);
	for (const profile of profiles) {
		await Got(profile, {
			url,
			headers: {
				DS: "synthetic-signature",
				Cookie: "ltuid_v2=synthetic-id",
				"x-rpc-page": "synthetic-page",
				"x-rpc-signgame": "synthetic-game",
				"x-rpc-device_id": "synthetic-device"
			}
		});
		assert.equal(requests.at(-1).headers.ds, "synthetic-signature");
		assert.equal(requests.at(-1).headers["x-rpc-page"], "synthetic-page");
		await Got(profile, { url });
		assertAbsent(requests.at(-1).headers, ["ds", "cookie", "x-rpc-page", "x-rpc-signgame", "x-rpc-device_id"]);
	}
	await Got("Global", { url });
	assertAbsent(requests.at(-1).headers, ["ds", "cookie", "x-rpc-client_type", "x-rpc-page"]);
});

test("unused global legacy profiles are no longer registered", () => {
	const definitions = require("../gots/index.js");
	assert.equal(definitions.some(({ name }) => name === "HoYoLab" || name === "HoyoClient"), false);
});
