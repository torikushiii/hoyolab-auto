const { redactUrl } = require("../../object/redact.js");

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
			http2: false,
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
						const endpoint = redactUrl(err.options?.url?.toString?.() ?? null);
						const code = err.code ?? null;
						const responseType = err.options?.responseType ?? null;
						const timeout = err.options?.timeout ?? null;

						// Only named fields. Inspecting the whole got error would print
						// its request options, which carry the Cookie header.
						app.Logger.debug("GotRequest", {
							error: {
								name: err.name,
								message: redactUrl(err.message ?? ""),
								stack: err.stack
							},
							context: {
								code,
								responseType,
								timeout,
								url: endpoint
							}
						});

						app.Logger.error("GotRequest", `Request failed (${method} ${endpoint ?? "UNKNOWN"}) code=${code ?? "N/A"} after ${retryAttempts} retries`);

						return err;
					}
				],
				afterResponse: [
					(response) => {
						const method = response.request?.options?.method?.toUpperCase?.() ?? "UNKNOWN";
						const url = response.url ?? response.request?.options?.url?.toString?.() ?? "UNKNOWN";

						// The Telegram long-poll runs every 5 seconds. Logging it buries
						// everything else and burns the log retention we need during an
						// incident, so it is the one request that stays silent.
						if (!url.includes("/getUpdates")) {
							app.Logger.debug("GotRequest", `${method} ${redactUrl(url)} → ${response.statusCode}`);
						}

						return response;
					}
				]
			}
		};
	}),
	parent: null
};

module.exports = definition;
