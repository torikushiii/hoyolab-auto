const { getLanguage } = require("../../gots/hoyolab-contexts/language.js");
const { APP_VERSION } = require("../../gots/hoyolab-contexts/constants.js");

// WebView request shape; successful official check-ins are captured separately.
module.exports = {
	profile: "HoYoLabAppWebView",
	actId: "e202303301540311",
	urls: {
		info: "https://sg-act-public-api.hoyolab.com/event/luna/hkrpg/os/info",
		home: "https://sg-act-public-api.hoyolab.com/event/luna/hkrpg/os/home",
		sign: "https://sg-act-public-api.hoyolab.com/event/luna/hkrpg/os/sign"
	},
	readOptions: (actId) => ({
		searchParams: { lang: getLanguage(), act_id: actId },
		headers: { "x-rpc-signgame": "hkrpg" }
	}),
	signOptions: (actId) => ({
		method: "POST",
		json: { act_id: actId, lang: getLanguage() },
		headers: {
			"x-rpc-signgame": "hkrpg",
			"x-rpc-client_type": 5,
			"x-rpc-app_version": APP_VERSION,
			"x-rpc-platform": 2
		}
	})
};
