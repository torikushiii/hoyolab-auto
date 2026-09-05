const { CronTime } = require("cron");

const MAX_TIMEOUT = 2147483647;
const MAX_DATE = 8640000000000000;
const MIN_INTERVAL = 5 * 60000;

const DURATION_UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };

const parseDuration = (value) => {
	if (typeof value !== "string" || !value.trim()) {
		return NaN;
	}
	const input = value.trim();
	const token = /(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)\s*/y;
	let total = 0;
	while (token.lastIndex < input.length) {
		const match = token.exec(input);
		if (!match) {
			return NaN;
		}
		total += Number(match[1]) * DURATION_UNITS[match[2]];
	}
	return total;
};

const validate = (name, options, crons = {}) => {
	const fail = (message) => {
		throw new Error(`crons.${name}: ${message}`);
	};
	if (!options || typeof options !== "object" || Array.isArray(options)) {
		fail("must be an object");
	}
	if (options.enabled !== undefined) {
		fail("enabled is not supported; choose a mode and use the cron whitelist/blacklist to disable jobs");
	}
	if (options.mode === "cron") {
		if (typeof options.expression !== "string" || !options.expression.trim()) {
			fail("expression must be a non-empty cron string");
		}
		try {
			return new CronTime(options.expression);
		}
		catch (e) {
			fail("expression is not a valid cron expression");
		}
	}
	if ((name === "mimo" || name === "hilichurl") && (crons[`${name}Jitter`] || 0) > 0) {
		fail(`set ${name}Jitter to 0 before enabling randomization`);
	}
	if (options.mode === "interval") {
		const min = parseDuration(options.min);
		const max = parseDuration(options.max);
		if (![min, max].every(value => Number.isFinite(value) && value >= MIN_INTERVAL && value <= MAX_DATE / 2)) {
			fail("min and max must be positive durations with units ms, s, m, h, d or w (e.g. '30m', '1h30m'), at least 5 minutes and within the JavaScript date range");
		}
		if (max < min) {
			fail("max must be >= min");
		}
	}
	else if (options.mode === "daily-window") {
		const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
		if (typeof options.start !== "string" || typeof options.end !== "string"
			|| !time.test(options.start) || !time.test(options.end) || options.end === options.start) {
			fail("start/end must be different HH:mm times");
		}
	}
	else {
		fail("mode must be cron, interval or daily-window");
	}
};

const sampleDelay = (options, random) => {
	const min = parseDuration(options.min);
	return min + (parseDuration(options.max) - min) * random();
};

const localDate = (timestamp) => {
	const date = new Date(timestamp);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const windowFor = (timestamp, options, offset = 0) => {
	const date = new Date(timestamp);
	const at = (time, dayOffset = 0) => {
		const [hour, minute] = time.split(":").map(Number);
		return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset + dayOffset, hour, minute).getTime();
	};
	return { start: at(options.start), end: at(options.end, options.end < options.start ? 1 : 0) };
};

// Overnight choices due before midnight remain eligible until their window closes.
const dailyDue = (options, state, now) => state.nextRunAt !== null && state.nextRunAt <= now
	&& state.lastAttemptDate !== localDate(now)
	&& state.lastWindowDate !== (state.windowDate || state.date)
	&& (state.date === localDate(now) || (options.end < options.start && now < state.windowEndAt));

const plan = (options, previous, now, random) => {
	const signature = JSON.stringify(options);
	const state = { ...previous, signature, mode: options.mode };
	const validChoice = previous?.signature === signature && Number.isFinite(previous.nextRunAt);
	if (options.mode === "interval") {
		state.nextRunAt = validChoice && previous.nextRunAt > now && previous.nextRunAt <= MAX_DATE
			? previous.nextRunAt
			: now + sampleDelay(options, random);
		return state;
	}

	const today = localDate(now);
	if (validChoice && previous.date === localDate(previous.nextRunAt)
		&& previous.lastWindowDate !== (previous.windowDate || previous.date)
		&& ((previous.nextRunAt > now && previous.date >= today && previous.date !== previous.lastAttemptDate)
			|| dailyDue(options, previous, now))) {
		return state;
	}
	let offset = options.end < options.start ? -1 : 0;
	let window;
	let start;
	// Advance by calendar days, retaining both window identity and actual attempt date.
	for (;;) {
		window = windowFor(now, options, offset++);
		start = Math.max(now, window.start);
		if (state.lastAttemptDate) {
			const nextDay = new Date(`${state.lastAttemptDate}T00:00:00`);
			nextDay.setDate(nextDay.getDate() + 1);
			start = Math.max(start, nextDay.getTime());
		}
		if (window.end > start && localDate(window.start) > (state.lastWindowDate || "")) {
			break;
		}
	}
	state.windowDate = localDate(window.start);
	state.windowEndAt = window.end;
	state.nextRunAt = Math.floor(start + (window.end - start) * random());
	state.date = localDate(state.nextRunAt);
	return state;
};

class RandomizedScheduler {
	constructor ({ name, options, code, cache, logger, now = Date.now, random = Math.random,
		setTimer = setTimeout, clearTimer = clearTimeout }) {
		Object.assign(this, { name, options, code, cache, logger, now, random, setTimer, clearTimer });
		this.key = `scheduler:${name}`;
		this.running = false;
		this.stopped = true;
	}

	async save () {
		if (await this.cache.set({ key: this.key, value: this.state, durable: true }) === false) {
			throw new Error("Unable to persist schedule");
		}
	}

	async start () {
		if (!this.stopped || this.running) {
			return;
		}
		this.stopped = false;
		try {
			this.state = plan(this.options, await this.cache.get(this.key), this.now(), this.random);
			await this.save();
			this.arm();
		}
		catch (e) {
			this.fail();
			throw e;
		}
	}

	stop () {
		this.stopped = true;
		this.clearTimer(this.timer);
	}

	fail () {
		this.stop();
		this.logger.error("Scheduler", `${this.name}: scheduling stopped because state could not be persisted or planned`);
	}

	arm () {
		if (this.stopped) {
			return;
		}
		this.logger.info("Scheduler", `${this.name}: next execution ${new Date(this.state.nextRunAt).toISOString()}`);
		this.timer = this.setTimer(() => this.tick().catch(() => this.fail()),
			Math.max(1, Math.min(MAX_TIMEOUT, Math.ceil(this.state.nextRunAt - this.now()))));
	}

	async tick () {
		if (this.stopped || this.running) {
			return;
		}
		if (this.now() < this.state.nextRunAt) {
			this.arm();
			return;
		}
		this.running = true;
		try {
			const daily = this.options.mode === "daily-window";
			const today = localDate(this.now());
			if (!daily || dailyDue(this.options, this.state, this.now())) {
				if (daily) {
					this.state.lastAttemptDate = today;
					this.state.lastWindowDate = this.state.windowDate || this.state.date;
					this.state.completedAt = null;
					this.state.succeeded = null;
				}
				// Invalidate the pending run before invoking code, including for interval restarts.
				this.state.nextRunAt = null;
				await this.save();
				try {
					await this.code();
					this.state.succeeded = true;
				}
				catch (e) {
					this.state.succeeded = false;
					this.logger.error("Scheduler", `${this.name}: job failed; continuing with the next scheduled run`);
				}
				this.state.completedAt = this.now();
			}
			this.state = plan(this.options, this.state, this.now(), this.random);
			await this.save();
			this.arm();
		}
		finally {
			this.running = false;
		}
	}
}

module.exports = { RandomizedScheduler, validate, parseDuration, sampleDelay, windowFor, localDate, plan, MAX_TIMEOUT };
