module.exports = class RegionalTaskManager {
	constructor () {
		this.tasks = new Map();
	}

	registerTask (name, hour, minute, callback) {
		this.tasks.set(name, { hour, minute, callback });
	}

	async executeTasks (options = {}) {
		const accounts = app.HoyoLab.getActiveAccounts(options);

		for (const account of accounts) {
			const now = new app.Date();
			now.setTimezoneOffset(account.timezone);

			for (const [taskName, task] of this.tasks) {
				if (now.hours === task.hour && now.getMinutes() >= task.minute && now.getMinutes() < task.minute + 5) {
					const lastExecutionKey = `last${taskName}Execution`;
					const lastExecution = account[lastExecutionKey]
						? new app.Date(account[lastExecutionKey])
						: null;

					if (!lastExecution || !this.isSameDay(lastExecution, now)) {
						await task.callback(account);
						account[lastExecutionKey] = now.toISOString();

						const platform = app.HoyoLab.get(account.platform);
						platform.update(account);

						app.Logger.debug(`RegionalTaskManager:${taskName}`, `Executed for account ${account.uid} in region ${account.region}`);
					}
				}
			}
		}
	}

	isSameDay (date1, date2) {
		return date1.getFullYear() === date2.getFullYear()
               && date1.getMonth() === date2.getMonth()
               && date1.getDate() === date2.getDate();
	}
};
