const { CronJob } = require("cron");

const CheckIn = require("./check-in/index.js");
const CodeRedeem = require("./code-redeem/index.js");
const DailiesReminder = require("./dailies-reminder/index.js");
const Expedition = require("./expedition/index.js");
const Stamina = require("./stamina/index.js");
const WeekliesReminder = require("./weeklies-reminder/index.js");

const definitions = [
	CheckIn,
	CodeRedeem,
	DailiesReminder,
	Expedition,
	Stamina,
	WeekliesReminder
];

const initCrons = () => {
	const crons = [];
	for (const definition of definitions) {
		const cron = {
			name: definition.name,
			description: definition.description,
			code: definition.code
		};

		const job = new CronJob(definition.expression, () => cron.code(cron));
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
