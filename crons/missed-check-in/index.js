module.exports = {
	name: "missed-check-in",
	expression: "0 0 23 * * *",
	description: "This check if all accounts successfully checked in today before daily reset",
	code: (async function missedCheckIn () {
		const accounts = app.Account.getActivePlatforms();

		app.Logger.log("Cron:MissedCheckIn", `Running missed check-in checker for ${accounts.length} accounts.`);
		for (const account of accounts) {
			await app.HoyoLab.checkIn(account, account.type);
		}

		app.Logger.log("Cron:MissedCheckIn", "Job finished.");
	})
};
