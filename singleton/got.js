module.exports = (async () => {
	const gotModule = await import("got");

	const got = gotModule.default.extend({
		retry: {
			limit: 2
		},
		timeout: {
			request: 5000
		},
		mutableDefaults: true,
		throwHttpErrors: true,
		headers: {
			Referer: "https://act.hoyolab.com",
			"x-rpc-app_version": "1.5.0",
			"x-rpc-client_type": 5,
			"x-rpc-language": "en-us",
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
		},
		hooks: {
			afterResponse: [
				// just to avoid being rate limited if you have a lot of accounts
				(response) => {
					const accounts = app?.Account?.getActivePlatforms();
					if (typeof accounts === "undefined") {
						return response;
					}

					if (accounts.length >= 5) {
						const delay = 2500;
						return new Promise((resolve) => setTimeout(() => resolve(response), delay));
					}

					return response;
				}
			],
			beforeError: [
				(e) => new app.Error.GenericRequest({
					body: e.response?.body ?? null,
					statusCode: e.response?.statusCode ?? null,
					statusMessage: e.response?.statusMessage ?? null,
					hostname: e.request?.options?.hostname,
					message: e.message,
					stack: e.stack
				})
			]
		}
	});

	return got;
})();
