const { getLanguage } = require("../gots/hoyolab-contexts/language.js");

const BASE_URL = "https://sg-public-api.hoyolab.com/event/e2023mimotravel";
const operations = {
	index: { method: "GET", profile: "HoYoLabAppWebView" },
	"task-list": { method: "GET", profile: "HoYoLabAppWebView" },
	"receive-point": { method: "GET", profile: "HoYoLabAppWebView" },
	"finish-task": { method: "POST", profile: "HoYoLabAppWebView" },
	"exchange-list": { method: "GET", profile: "HoYoLabDesktopWeb" },
	"point-record": { method: "GET", profile: "HoYoLabDesktopWeb" },
	exchange: { method: "POST", profile: "HoYoLabDesktopWeb" },
	"lottery-info": { method: "GET", profile: "HoYoLabDesktopWeb" },
	lottery: { method: "POST", profile: "HoYoLabDesktopWeb" }
};

const buildMimoRequest = (gameId, endpoint, { params = {}, data = null, cookie, method = "GET" } = {}) => {
	const genshin = gameId === 2;
	const url = `${BASE_URL}/${genshin ? `qiuqiu/${endpoint.replace(/-/g, "_")}` : endpoint}`;
	const headers = { Cookie: cookie };
	// Unreachable from supported cron/command consumers. Preserve the two internal
	// lottery methods' old defaults until an official qiuqiu contract is available.
	if (genshin && (endpoint === "lottery-info" || endpoint === "lottery")) {
		return { profile: "Global",
			options: {
				url,
				responseType: "json",
				throwHttpErrors: false,
				method,
				headers: {
					Referer: "https://act.hoyolab.com",
					"x-rpc-app_version": "1.5.0",
					"x-rpc-client_type": 5,
					"x-rpc-language": getLanguage(),
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
					...headers
				},
				...(method === "GET" ? { searchParams: params } : { json: data || params })
			} };
	}
	const operation = operations[endpoint];
	if (!operation) {
		throw new Error("Unsupported Mimo operation");
	}
	const requestMethod = genshin && endpoint === "receive-point" ? "POST" : operation.method;
	const payload = { ...(data || params) };
	const lang = payload.lang || getLanguage();
	if (genshin) {
		headers["x-rpc-client_type"] = 2;
		headers["x-rpc-language"] = lang;
		if (requestMethod === "POST") {
			delete payload.lang;
		}
	}
	return { profile: genshin ? "HoYoLabAppWebView" : operation.profile,
		options: {
			url,
			method: requestMethod,
			responseType: "json",
			throwHttpErrors: false,
			headers,
			searchParams: requestMethod === "GET" ? payload : { lang },
			...(requestMethod === "POST" ? { json: payload } : {})
		} };
};

module.exports = { buildMimoRequest };
