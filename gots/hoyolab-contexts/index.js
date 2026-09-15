const { getLanguage } = require("./language.js");

// Shared by the new Android identities; legacy profiles retain their versions.
const { APP_VERSION } = require("./constants.js");
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const WEBVIEW_USER_AGENT = `Mozilla/5.0 (Linux; Android 17; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.0.0 Mobile Safari/537.36 miHoYoBBSOversea/${APP_VERSION}`;

// No shared DS, cookie, device identity, page, route or query defaults.
// Endpoints opt into those fields explicitly, including DS on some WebViews.
module.exports = [
	{
		name: "HoYoLabDesktopWeb",
		parent: "Global",
		optionsType: "object",
		options: {
			headers: {
				Accept: "application/json, text/plain, */*",
				Origin: "https://act.hoyolab.com",
				Referer: "https://act.hoyolab.com/",
				"User-Agent": DESKTOP_USER_AGENT
			}
		}
	},
	{
		name: "HoYoLabAppWebView",
		parent: "Global",
		optionsType: "object",
		options: {
			headers: {
				Accept: "application/json, text/plain, */*",
				Origin: "https://act.hoyolab.com",
				Referer: "https://act.hoyolab.com/",
				"User-Agent": WEBVIEW_USER_AGENT,
				"x-requested-with": "com.mihoyo.hoyolab"
			}
		}
	},
	{
		name: "HoYoLabGameRecordDesktopWeb",
		parent: "HoYoLabDesktopWeb",
		optionsType: "function",
		options: () => ({
			headers: {
				"x-rpc-client_type": 5,
				"x-rpc-app_version": "1.5.0",
				"x-rpc-platform": 4,
				"x-rpc-language": getLanguage(),
				"x-rpc-lang": getLanguage(),
				"x-rpc-env": "default"
			}
		})
	},
	{
		name: "HoYoLabGameRecordAppWebView",
		parent: "HoYoLabAppWebView",
		optionsType: "function",
		options: () => ({
			headers: {
				"x-rpc-client_type": 5,
				"x-rpc-app_version": APP_VERSION,
				"x-rpc-platform": 2,
				"x-rpc-language": getLanguage(),
				"x-rpc-lang": getLanguage(),
				"x-rpc-env": "default"
			}
		})
	},
	{
		name: "HoYoLabNative",
		parent: "Global",
		optionsType: "function",
		options: () => ({
			headers: {
				"User-Agent": "okhttp/4.12.0",
				Referer: "https://app.hoyolab.com",
				"x-rpc-client_type": 2,
				"x-rpc-app_version": APP_VERSION,
				"x-rpc-language": getLanguage()
			}
		})
	}
];
