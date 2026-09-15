module.exports = class RegionalTaskManager {
	constructor () {
		this.tasks = new Map();
	}

	registerTask (name, hour, minute, callback, options = {}) {
		const formatter = options.timeZone
			? new Intl.DateTimeFormat("en-CA", {
				timeZone: options.timeZone,
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23"
			})
			: null;

		this.tasks.set(name, { hour, minute, callback, formatter });
	}

	async executeTasks (options = {}) {
		const accounts = app.HoyoLab.getActiveAccounts(options);

		for (const account of accounts) {
			const accountNow = new app.Date();
			accountNow.setTimezoneOffset(account.timezone);

			for (const [taskName, task] of this.tasks) {
				const now = task.formatter ? new app.Date() : accountNow;
				const time = task.formatter
					? this.getDateParts(now, task.formatter)
					: { hour: now.hours, minute: now.getMinutes() };

				if (time.hour === task.hour && time.minute >= task.minute && time.minute < task.minute + 5) {
					const lastExecutionKey = `last${taskName}Execution`;
					const lastExecution = account[lastExecutionKey]
						? new app.Date(account[lastExecutionKey])
						: null;

					if (!lastExecution || !this.isSameDay(lastExecution, now, task.formatter)) {
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

	getDateParts (date, formatter) {
		return Object.fromEntries(formatter.formatToParts(date)
			.filter(part => part.type !== "literal")
			.map(part => [part.type, Number(part.value)]));
	}

	isSameDay (date1, date2, formatter = null) {
		if (formatter) {
			const first = this.getDateParts(date1, formatter);
			const second = this.getDateParts(date2, formatter);

			return first.year === second.year
				&& first.month === second.month
				&& first.day === second.day;
		}

		return date1.getFullYear() === date2.getFullYear()
               && date1.getMonth() === date2.getMonth()
               && date1.getDate() === date2.getDate();
	}
};
