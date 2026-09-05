const { t } = require("../localization/index.js");

const { CronJob } = require("cron");
const { RandomizedScheduler, validate } = require("./randomized-scheduler.js");

const CheckIn = require("./check-in/index.js");
const CodeRedeem = require("./code-redeem/index.js");
const DailiesReminder = require("./dailies-reminder/index.js");
const Expedition = require("./expedition/index.js");
const GiftCodeRedeem = require("./gift-code-redeem/index.js");
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
	GiftCodeRedeem,
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

const FixedScheduleCrons = [
	"dailies-reminder",
	"howl-scratch-card",
	"weeklies-reminder"
];

const initCrons = () => {
	const { blacklist = [], whitelist = []} = config.crons;
	if (blacklist.length > 0 && whitelist.length > 0) {
		throw new Error(t `Cannot have both a blacklist and a whitelist for crons`);
	}

	if (config.crons.randomization !== undefined) {
		throw new Error("Move crons.randomization entries directly to crons.<name> and remove enabled; select mode: cron to use a fixed schedule");
	}
	const schedules = new Map();
	const selectedDefinitions = definitions.filter(definition => !blacklist.includes(definition.name)
		&& (whitelist.length === 0 || whitelist.includes(definition.name)));
	for (const definition of selectedDefinitions) {
		const name = app.Utils.convertCase(definition.name, "kebab", "camel");
		const value = config.crons[name];
		if (FixedScheduleCrons.includes(definition.name)) {
			if (value && typeof value === "object") {
				throw new Error(`crons.${name}: this job uses a built-in fixed schedule and does not support schedule objects`);
			}
			// Legacy overrides for these jobs were ignored; retain that behavior.
			continue;
		}
		// Existing strings (including empty fallback values) retain their behavior.
		const options = !value || typeof value === "string"
			? { mode: "cron", expression: value || definition.expression }
			: value;
		validate(name, options, config.crons);
		schedules.set(name, options);
	}

	const crons = [];
	for (const definition of selectedDefinitions) {
		if (FixedScheduleCrons.includes(definition.name)) {
			const name = app.Utils.convertCase(definition.name, "kebab", "camel");
			const job = new CronJob(definition.expression, () => definition.code(), null, false, definition.timeZone);
			job.start();
			crons.push({ name, job });
			continue;
		}

		const randomizedName = app.Utils.convertCase(definition.name, "kebab", "camel");
		if (schedules.get(randomizedName).mode !== "cron") {
			const cron = { name: definition.name, description: definition.description, code: definition.code };
			const job = new RandomizedScheduler({
				name: randomizedName,
				options: schedules.get(randomizedName),
				code: () => cron.code(cron),
				cache: app.Cache,
				logger: app.Logger
			});
			crons.push({ ...cron, job });
			continue;
		}

		const cron = {
			name: definition.name,
			description: definition.description,
			code: definition.code
		};

		const name = app.Utils.convertCase(definition.name, "kebab", "camel");

		const expression = schedules.get(name).expression;
		const job = new CronJob(expression, () => cron.code(cron), null, false, definition.timeZone);
		job.start();

		crons.job = job;
		crons.push(cron);
	}

	app.Logger.info("Cron", t `Initialized ${crons.length} cron jobs`);
	return crons;
};

module.exports = {
	initCrons
};
