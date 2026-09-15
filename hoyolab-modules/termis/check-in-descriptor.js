const { getLanguage } = require("../../gots/hoyolab-contexts/language.js");
const { APP_VERSION } = require("../../gots/hoyolab-contexts/constants.js");

// WebView request shape observed without a linked character; success remains unverified.
module.exports = {
	profile: "HoYoLabAppWebView",
	actId: "e202202281857121",
	urls: {
		info: "https://sg-act-public-api.hoyolab.com/event/luna/nxx/os/info",
		home: "https://sg-act-public-api.hoyolab.com/event/luna/nxx/os/home",
		sign: "https://sg-act-public-api.hoyolab.com/event/luna/nxx/os/sign"
	},
	readOptions: (actId) => ({
		searchParams: { lang: getLanguage(), act_id: actId },
		headers: { "x-rpc-signgame": "nxx" }
	}),
	signOptions: (actId) => ({
		method: "POST",
		json: { act_id: actId, lang: getLanguage() },
		headers: {
			"x-rpc-signgame": "nxx",
			"x-rpc-client_type": 5,
			"x-rpc-app_version": APP_VERSION,
			"x-rpc-platform": 2
		}
	})
};
