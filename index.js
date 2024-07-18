const file = require("node:fs");
const JSON5 = require("json5");

const Command = require("./classes/command.js");
const Config = require("./classes/config.js");
const Got = require("./classes/got.js");

const Cache = require("./singleton/cache.js");
const Logger = require("./singleton/logger.js");
const Utils = require("./singleton/utils.js");

const HoyoLab = require("./hoyolab-modules/template.js");
const Platform = require("./platforms/template.js");

const Error = require("./object/error.js");

let config;
try {
	config = JSON5.parse(file.readFileSync("./config.json5"));
}
catch {
	try {
		config = JSON5.parse(file.readFileSync("./default.config.json5"));
	}
	catch (e) {
		throw new Error({ message: "No default or custom configuration found." });
	}
}

(async () => {
	const start = process.hrtime.bigint();

	const platformsConfig = config.platforms;
	if (!platformsConfig || platformsConfig.length === 0) {
		console.warn("No platforms configured! Exiting.");
		process.exit(0);
	}

	globalThis.app = {
		Error,

		Config,
		Command,

		Got: await Got.initialize(),
		Cache: new Cache(),
		Logger: new Logger(config.loglevel),
		Utils: new Utils()
	};

	app.Logger.info("Client", "Loading configuration data");
	Config.load(config);
	app.Logger.info("Client", `Loaded ${Config.data.size} configuration entries`);

	const platforms = new Set();
	for (const definition of platformsConfig) {
		if (!definition.active) {
			app.Logger.warn("Client", `Skipping ${definition.type} platform (inactive)`);
			continue;
		}

		platforms.add(Platform.create(definition.type, definition));
	}

	const { loadCommands } = require("./commands/index.js");
	const commands = await loadCommands();
	await Command.importData(commands.definitions);

	const { initCrons } = require("./crons/index.js");
	initCrons();

	const accountsConfig = config.accounts;
	if (!accountsConfig || accountsConfig.length === 0) {
		app.Logger.warn("Client", "No accounts configured! Exiting.");
		process.exit(0);
	}

	const accounts = new Set();
	for (const definition of accountsConfig) {
		if (!definition.active) {
			app.Logger.warn("Client", `Skipping ${definition.type} account (inactive)`);
			continue;
		}

		accounts.add(HoyoLab.create(definition.type, definition));
	}

	const definitions = require("./gots/index.js");
	await app.Got.importData(definitions);

	globalThis.app = {
		...app,
		Platform,
		HoyoLab
	};

	const promises = [];
	for (const platform of platforms) {
		promises.push(platform.connect());
	}

	const hoyoPromises = [];
	for (const account of accounts) {
		hoyoPromises.push(account.login());
	}

	await Promise.all(promises);
	await Promise.all(hoyoPromises);

	const end = process.hrtime.bigint();
	app.Logger.info("Client", `Initialize completed (${Number(end - start) / 1e6}ms)`);

	process.on("unhandledRejection", (reason) => {
		if (!(reason instanceof Error)) {
			return;
		}

		app.Logger.log("Client", {
			message: "Unhandled promise rejection",
			args: { reason }
		});
	});
})();
