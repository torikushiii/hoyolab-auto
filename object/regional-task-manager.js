const { t } = require("../localization/index.js");

module.exports = class RegionalTaskManager {
	constructor ({ now = Date.now, random = Math.random, setTimer = setTimeout } = {}) {
		this.tasks = new Map();
		this.pending = new Map();
		Object.assign(this, { now, random, setTimer });
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

	clock (account, task) {
		const timestamp = this.now();
		const now = new app.Date(timestamp);
		if (!task.formatter) {
			now.setTimezoneOffset(account.timezone);
		}
		const time = task.formatter
			? this.getDateParts(now, task.formatter)
			: {
				year: now.getFullYear(),
				month: now.getMonth() + 1,
				day: now.getDate(),
				hour: now.hours,
				minute: now.getMinutes()
			};
		const remaining = (Math.min(60, task.minute + 5) - time.minute) * 60000
			- now.getSeconds() * 1000 - now.getMilliseconds();
		return { now,
			timestamp,
			date: `${time.year}-${time.month}-${time.day}`,
			endAt: timestamp + remaining,
			inWindow: time.hour === task.hour && time.minute >= task.minute && remaining > 0 };
	}

	async save (key, value) {
		if (await app.Cache.set({ key, value, durable: true }) === false) {
			throw new Error("Unable to persist reminder schedule");
		}
	}

	async executeTasks (options = {}) {
		for (const account of app.HoyoLab.getActiveAccounts(options)) {
			for (const [taskName, task] of this.tasks) {
				const clock = this.clock(account, task);
				if (!clock.inWindow) {
					continue;
				}
				const key = `scheduler:regional:${JSON.stringify([taskName, account.platform, account.region, account.uid ?? account.ltuid])}`;
				if (this.pending.has(key)) {
					continue;
				}
				// Reserve before any asynchronous cache access to prevent overlapping polls.
				this.pending.set(key, true);
				try {
					const previous = await app.Cache.get(key);
					const lastExecution = account[`last${taskName}Execution`];
					if (previous?.attemptedDate === clock.date || (lastExecution
						&& this.isSameDay(new app.Date(lastExecution), clock.now, task.formatter))) {
						this.pending.delete(key);
						continue;
					}
					const signature = JSON.stringify([task.hour, task.minute, task.formatter?.resolvedOptions().timeZone, account.timezone]);
					const reusable = previous?.date === clock.date && previous.signature === signature
						&& Number.isFinite(previous.nextRunAt) && previous.nextRunAt < clock.endAt;
					const state = reusable
						? previous
						: { date: clock.date,
							signature,
							nextRunAt: clock.timestamp + Math.floor(this.random() * (clock.endAt - clock.timestamp)) };
					await this.save(key, state);
					app.Logger.debug("RegionalTaskManager", `${taskName}: next execution ${new Date(state.nextRunAt).toISOString()}`);
					this.setTimer(() => this.run({ key, state, account, taskName, task, options })
						.catch(() => app.Logger.error("RegionalTaskManager", "Reminder failed; waiting for the next window"))
						.finally(() => this.pending.delete(key)), Math.max(1, state.nextRunAt - this.now()));
				}
				catch (e) {
					this.pending.delete(key);
					throw e;
				}
			}
		}
	}

	async run ({ key, state, account, taskName, task, options }) {
		const clock = this.clock(account, task);
		if (!clock.inWindow || clock.date !== state.date || !app.HoyoLab.getActiveAccounts(options).includes(account)) {
			return;
		}
		if ((await app.Cache.get(key))?.attemptedDate === clock.date) {
			return;
		}
		state.attemptedDate = clock.date;
		// Persist the attempt before API calls so a crash cannot repeat today's request.
		await this.save(key, state);
		const ready = this.clock(account, task);
		if (!ready.inWindow || ready.date !== state.date) {
			return;
		}
		if (await task.callback(account) === false) {
			return;
		}
		account[`last${taskName}Execution`] = clock.now.toISOString();
		app.HoyoLab.get(account.platform).update(account);
		app.Logger.debug(`RegionalTaskManager:${taskName}`, t `Executed for account ${account.uid} in region ${account.region}`);
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
