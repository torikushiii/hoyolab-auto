const { CronJob } = require("cron");

const CheckIn = require("./check-in/index.js");
const CodeRedeem = require("./code-redeem/index.js");
const DailiesReminder = require("./dailies-reminder/index.js");
const Expedition = require("./expedition/index.js");
const Hilichurl = require("./hilichurl/index.js");
const HowlScratchCard = require("./howl-scratch-card/index.js");
const Mimo = require("./mimo/index.js");
const MissedCheckIn = require("./missed-check-in/index.js");
const RealmCurrency = require("./realm-currency/index.js");
const ShopStatus = require("./shop-status/index.js");
const Stamina = require("./stamina/index.js");
const UpdateCookie = require("./update-cookie/index.js");
const WeekliesReminder = require("./weeklies-reminder/index.js");

const config = require("../config.js");

const definitions = [
	CheckIn,
	CodeRedeem,
	DailiesReminder,
	Expedition,
	Hilichurl,
	HowlScratchCard,
	Mimo,
	MissedCheckIn,
	RealmCurrency,
	ShopStatus,
	Stamina,
	UpdateCookie,
	WeekliesReminder
];

const BlacklistedCrons = [
	"dailiesReminder",
	"howlScratchCard",
	"weekliesReminder"
];

const initCrons = () => {
	const { blacklist = [], whitelist = []} = config.crons;
	if (blacklist.length > 0 && whitelist.length > 0) {
		throw new Error(`Cannot have both a blacklist and a whitelist for crons`);
	}

	const crons = [];
	for (const definition of definitions) {
		if (blacklist.length > 0 && blacklist.includes(definition.name)) {
			continue;
		}
		else if (whitelist.length > 0 && !whitelist.includes(definition.name)) {
			continue;
		}
		else if (BlacklistedCrons.includes(definition.name)) {
			const name = app.Utils.convertCase(definition.name, "kebab", "camel");

			const expression = definition.expression;
			const job = new CronJob(expression, () => definition.code());
			job.start();

			crons.job = job;
			crons.push({ name, job });

			continue;
		}

		const cron = {
			name: definition.name,
			description: definition.description,
			code: definition.code
		};

		const name = app.Utils.convertCase(definition.name, "kebab", "camel");

		const expression = config.crons[name] || definition.expression;
		const job = new CronJob(expression, () => cron.code(cron));
		job.start();

		crons.job = job;
		crons.push(cron);
	}

	app.Logger.info("Cron", `Initialized ${crons.length} cron jobs`);
	return crons;
};

module.exports = {
	initCrons
};
