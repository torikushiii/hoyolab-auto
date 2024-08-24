const RegionalTaskManager = new app.RegionalTaskManager();

RegionalTaskManager.registerTask("MissedCheckIn", 23, 0, async (account) => {
	const platform = app.HoyoLab.get(account.platform);
	await platform.checkIn(account);
});

module.exports = {
	name: "missed-check-in",
	expression: "*/5 * * * *",
	description: "This check if all accounts successfully checked in today before daily reset",
	code: (async function missedCheckIn () {
		await RegionalTaskManager.executeTasks();
	})
};
