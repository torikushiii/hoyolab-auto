module.exports = (async () => {
	const gotModule = await import("got");

	const got = gotModule.default.extend({
		retry: {
			limit: 3
		},
		timeout: {
			request: 2500
		},
		mutableDefaults: true,
		throwHttpErrors: true,
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
		}
	});

	return got;
})();
