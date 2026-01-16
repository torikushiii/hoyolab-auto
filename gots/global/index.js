const definition = {
	name: "Global",
	optionsType: "function",
	options: (() => {
		const retryConfig = app.Config.get("retry") ?? {};
		const retryAttempts = Number.isFinite(retryConfig.attempts) ? Math.max(0, retryConfig.attempts) : 0;
		const retryDelayMs = Number.isFinite(retryConfig.delayMs) ? Math.max(0, retryConfig.delayMs) : 1000;
		const requestTimeoutMs = Number.isFinite(retryConfig.timeoutMs) ? Math.max(0, retryConfig.timeoutMs) : 30000;

		return {
			responseType: "json",
			http2: true,
			retry: {
				limit: retryAttempts,
				calculateDelay: ({ computedValue }) => (computedValue === 0 ? 0 : retryDelayMs)
			},
			timeout: {
				request: requestTimeoutMs
			},
			mutableDefaults: true,
			throwHttpErrors: false,
			headers: {
				"User-Agent": app.Config.get("userAgent")
			},
			hooks: {
				beforeError: [
					async (err) => {
						if (!err) {
							return err;
						}

						const method = err.options?.method?.toUpperCase?.() ?? "UNKNOWN";
						const endpoint = err.options?.url?.toString?.() ?? "UNKNOWN";
						const status = err.response?.statusCode ?? "N/A";
						const responseType = err.options?.responseType ?? null;
						const timeout = err.options?.timeout ?? null;

						app.Logger.debug("GotRequest", {
							error: err,
							context: {
								code: err.code ?? null,
								method,
								responseType,
								timeout,
								url: endpoint,
								status
							}
						});

						app.Logger.error("GotRequest", `Request failed (${method} ${endpoint}) status=${status} after ${retryAttempts} retries`);

						return err;
					}
				]
			}
		};
	}),
	parent: null
};

module.exports = definition;
