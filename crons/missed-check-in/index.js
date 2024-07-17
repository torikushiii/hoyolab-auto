module.exports = {
	name: "missedCheckIn",
	expression: "0 0 23 * * *",
	description: "This check if all accounts successfully checked in today before daily reset",
	code: (async function missedCheckIn () {
		const accounts = app.HoyoLab.getActiveAccounts();
		if (accounts.length === 0) {
			app.Logger.warn("Cron:MissedCheckIn", "No active accounts found for HoyoLab");
			return;
		}

		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);
			await platform.checkAndExecute();
		}
	})
};
