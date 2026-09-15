const { getLanguage } = require("../../gots/hoyolab-contexts/language.js");

// Genshin desktop event contract; other games have different routes and sign bodies.
module.exports = {
	profile: "HoYoLabDesktopWeb",
	actId: "e202102251931481",
	urls: {
		info: "https://sg-act-public-api.hoyolab.com/event/sol/info",
		home: "https://sg-act-public-api.hoyolab.com/event/sol/home",
		sign: "https://sg-act-public-api.hoyolab.com/event/sol/sign"
	},
	signOptions: (actId) => ({
		method: "POST",
		searchParams: { lang: getLanguage() },
		json: { act_id: actId },
		headers: {
			"x-rpc-signgame": "hk4e",
			"x-rpc-platform": "4"
		}
	})
};
