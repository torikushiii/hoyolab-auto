const Account = require("./classes/account.js");
const Command = require("./classes/command.js");
const Config = require("./classes/config.js");

const Error = require("./object/error.js");

const HoyoLab = require("./singleton/hoyolab/index.js");
const Got = require("./singleton/got.js");
const Logger = require("./singleton/logger.js");
const Utils = require("./singleton/utils.js");

let configData;
try {
	configData = require("./config.js");
}
catch {
	try {
		configData = require("./default.config.js");
	}
	catch {
		throw new Error({ message: "No default or custom config file found." });
	}
}

(async () => {
	const start = process.hrtime.bigint();
	globalThis.app = {
		Error,
		Logger: new Logger(),

		Config,
		Command,
		Got: await Got,
		Utils: new Utils()
	};

	app.Logger.info("Client", "Loading configuration data");
	Config.load(configData);
	app.Logger.info("Client", `Loaded ${Config.data.size} configuration entries`);

	const { loadCommands } = require("./commands/index.js");
	const commands = await loadCommands();

	await Command.importData(commands.definitions);

	globalThis.app = {
		...app,
		Account: await Account.initialize(configData.accounts),
		HoyoLab: new HoyoLab()
	};

	const { initCrons } = require("./crons/index.js");
	initCrons();

	const platforms = [
		"Discord",
		"Webhook",
		"Telegram"
	];

	for (const platform of platforms) {
		let Controller = null;
		try {
			Controller = require(`./controllers/${platform.toLowerCase()}.js`);
		}
		catch (e) {
			app.Logger.error(`Failed to load ${platform}.`, e);
			continue;
		}

		try {
			app[platform] = new Controller();
		}
		catch (e) {
			app.Logger.error("Client", {
				message: `Failed to initialize ${platform}.`,
				args: { error: e }
			});
			app.Logger.warn(platform, `Skipping ${platform} initialization`);
			continue;
		}
	}

	const end = process.hrtime.bigint();
	app.Logger.info("Client", `Initialize completed (${Number(end - start) / 1e6}ms)`);

	process.on("unhandledRejection", (reason) => {
		if (!(reason instanceof Error)) {
			return;
		}

		app.Logger.error("Client", {
			message: "Unhandled promise rejection",
			args: { reason }
		});
	});
})();
