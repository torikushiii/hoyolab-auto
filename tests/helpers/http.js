const { Readable } = require("node:stream");
const Got = require("../../classes/got.js");

// Use sequential tests: the application's registry and Config are process globals.
const createHttpHarness = async (t, config = {}) => {
	const previousApp = global.app;
	const logs = [];
	global.app = {
		Config: { get: (key) => config[key] },
		Logger: {
			debug: (...args) => logs.push(args),
			error: (...args) => logs.push(args)
		},
		Error
	};
	t.after(() => {
		global.app = previousApp;
	});

	// Legacy object definitions read Config at require time, just as at app startup.
	for (const path of ["../../gots/index.js", "../../gots/hoyolab/index.js", "../../gots/hoyo-client/index.js"]) {
		delete require.cache[require.resolve(path)];
	}
	const definitions = require("../../gots/index.js");
	const requests = [];
	const replies = [];
	const globalDefinition = definitions.find((definition) => definition.name === "Global");
	const globalOptions = globalDefinition.options();
	const capture = (options) => {
		requests.push({
			url: new URL(options.url),
			method: options.method,
			headers: { ...options.headers },
			body: options.body,
			transport: {
				http2: options.http2,
				responseType: options.responseType,
				throwHttpErrors: options.throwHttpErrors,
				timeout: { ...options.timeout },
				retry: { ...options.retry },
				beforeError: [...options.hooks.beforeError]
			}
		});
		const { body = { retcode: 0 }, statusCode = 200 } = replies.shift() ?? {};
		return Object.assign(Readable.from([JSON.stringify(body)]), {
			statusCode,
			statusMessage: "Synthetic response",
			headers: { "content-type": "application/json" },
			rawHeaders: ["content-type", "application/json"],
			trailers: {}
		});
	};
	const offlineGlobal = {
		...globalDefinition,
		optionsType: "object",
		options: {
			...globalOptions,
			request: () => {
				throw new Error("HTTP test attempted network access");
			},
			hooks: {
				...globalOptions.hooks,
				beforeRequest: [
					...(globalOptions.hooks.beforeRequest ?? []),
					(options) => {
						// Capture at transport time, after all endpoint hooks have run.
						options.request = () => capture(options);
					}
				]
			}
		}
	};
	await Got.initialize();
	await Got.importData(definitions.map((definition) => definition === globalDefinition ? offlineGlobal : definition));
	app.Got = Got;
	return { Got, requests, replies, logs };
};

module.exports = { createHttpHarness };
