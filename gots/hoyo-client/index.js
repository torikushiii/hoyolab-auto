const definition = {
	name: "HoyoClient",
	optionsType: "object",
	options: {
		headers: {
			Referer: "https://act.hoyolab.com",
			"x-rpc-client_type": 5,
			"x-rpc-language": "en-us",
			"x-rpc-app_version": "2.54.0",
			"x-requested-with": "com.mihoyo.hoyolab",
			"User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 5 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36 miHoYoBBSOversea/2.54.0"
		}
	},
	parent: "Global"
};

module.exports = definition;
