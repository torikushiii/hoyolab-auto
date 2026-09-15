const { getLanguage } = require("../../gots/hoyolab-contexts/language.js");

// WebView request shape observed without a linked character; success remains unverified.
module.exports = {
	profile: "HoYoLabAppWebView",
	actId: "e202110291205111",
	urls: {
		info: "https://sg-act-public-api.hoyolab.com/event/mani/info",
		home: "https://sg-act-public-api.hoyolab.com/event/mani/home",
		sign: "https://sg-act-public-api.hoyolab.com/event/mani/sign"
	},
	readOptions: (actId) => ({
		searchParams: { lang: getLanguage(), act_id: actId },
		headers: { "x-rpc-signgame": "bh3" }
	}),
	signOptions: (actId) => ({
		method: "POST",
		searchParams: { lang: getLanguage() },
		json: { act_id: actId },
		headers: { "x-rpc-signgame": "bh3" }
	})
};
