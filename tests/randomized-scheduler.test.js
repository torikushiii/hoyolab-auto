const { test } = require("node:test");
const assert = require("node:assert/strict");
const { RandomizedScheduler, validate, parseDuration, sampleDelay, localDate, windowFor, plan, MAX_TIMEOUT } = require("../crons/randomized-scheduler.js");

const interval = { mode: "interval", min: "30m", max: "1h" };
const daily = { mode: "daily-window", start: "00:30", end: "02:00" };
const at = (hour, minute = 0, day = 5) => new Date(2026, 8, day, hour, minute).getTime();
const middle = () => 0.5;

const harness = (options, timestamp, previous) => {
	let time = timestamp;
	let stored = previous;
	const timers = [];
	const calls = [];
	const scheduler = new RandomizedScheduler({
		name: "test",
		options,
		now: () => time,
		random: middle,
		cache: {
			get: async () => structuredClone(stored),
			set: async ({ value }) => { stored = structuredClone(value); }
		},
		logger: { info: () => {}, error: () => {} },
		code: async () => { calls.push(time); },
		setTimer: (callback, delay) => { timers.push({ callback, delay }); },
		clearTimer: () => {}
	});
	return { scheduler,
		timers,
		calls,
		stored: () => stored,
		time: value => {
			time = value;
		} };
};

test("configuration validates bounds, cron mode and legacy jitter", () => {
	validate("test", interval);
	validate("test", { ...interval, max: "30m" });
	validate("test", { mode: "cron", expression: "0 0 0 * * *" });
	assert.throws(() => validate("test", { mode: "cron", expression: "invalid" }));
	assert.throws(() => validate("test", { mode: "cron" }));
	assert.throws(() => validate("test", { enabled: false }));
	for (const value of [-1, 0, NaN, Infinity, "30"]) {
		assert.throws(() => validate("test", { ...interval, min: value }), /crons.test/);
		assert.throws(() => validate("test", { ...interval, max: value }));
	}
	assert.throws(() => validate("test", { ...interval, max: "29m" }));
	assert.throws(() => validate("test", { ...interval, enabled: "false" }));
	assert.throws(() => validate("test", { mode: "jitter" }));
	for (const start of ["2:00", "24:00", "00:60", "02:00"]) {
		assert.throws(() => validate("test", { ...daily, start }));
	}
	for (const name of ["mimo", "hilichurl"]) {
		assert.throws(() => validate(name, interval, { [`${name}Jitter`]: 10 }), /Jitter/);
		validate(name, interval, { [`${name}Jitter`]: 0 });
	}
});

test("daily windows reject non-string times before planning", () => {
	for (const value of [undefined, null, 30, true, ["00:30"], ["02:00"], {}, { toString: () => "00:30" }]) {
		for (const field of ["start", "end"]) {
			assert.throws(() => validate("test", { ...daily, [field]: value }), /crons.test: start\/end must be different HH:mm times/);
		}
	}
});

test("interval sampling stays within bounds, including equal bounds", () => {
	for (let i = 0; i <= 100; i++) {
		const delay = sampleDelay(interval, () => i / 100);
		assert.ok(delay >= 30 * 60000 && delay <= 60 * 60000);
		assert.equal(sampleDelay({ ...interval, max: "30m" }, () => i / 100), 30 * 60000);
	}
});

test("interval resumes future choices and resamples expired or incompatible state", () => {
	const original = plan(interval, undefined, at(0), middle);
	assert.equal(plan(interval, original, at(0, 10), () => 0).nextRunAt, original.nextRunAt);
	assert.equal(plan(interval, original, at(2), middle).nextRunAt, at(2, 45));
	assert.equal(plan({ ...interval, max: "30m" }, original, at(0, 10), middle).nextRunAt, at(0, 40));
});

test("completion determines the next interval; concurrent ticks cannot overlap", async () => {
	const h = harness(interval, at(0));
	await h.scheduler.start();
	h.time(at(0, 45));
	let finish;
	h.scheduler.code = () => new Promise(resolve => {
		finish = resolve;
	});
	const execution = h.scheduler.tick();
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(h.stored().nextRunAt, null);
	await h.scheduler.tick();
	assert.equal(h.timers.length, 1);
	h.time(at(1));
	finish();
	await execution;
	assert.equal(h.stored().nextRunAt, at(1, 45));
});

test("daily planning before, during and after the window", () => {
	assert.equal(plan(daily, undefined, at(0), middle).nextRunAt, at(1, 15));
	assert.equal(plan(daily, undefined, at(1), middle).nextRunAt, at(1, 30));
	assert.equal(plan(daily, undefined, at(3), middle).nextRunAt, at(1, 15, 6));
	assert.equal(plan(daily, undefined, at(2), middle).date, localDate(at(0, 0, 6)));
	const bounds = windowFor(at(0), daily);
	for (let i = 0; i < 100; i++) {
		const choice = plan(daily, undefined, at(0), () => i / 100).nextRunAt;
		assert.ok(choice >= bounds.start && choice < bounds.end);
	}
});

test("daily choice survives restart, including a choice already due today", async () => {
	const h = harness(daily, at(0));
	await h.scheduler.start();
	const future = harness(daily, at(1), h.stored());
	await future.scheduler.start();
	assert.equal(future.stored().nextRunAt, at(1, 15));
	const overdue = harness(daily, at(3), h.stored());
	await overdue.scheduler.start();
	await overdue.scheduler.tick();
	assert.equal(overdue.calls.length, 1);
	assert.equal(overdue.stored().nextRunAt, at(1, 15, 6));
});

test("attempt is saved before invocation and a crash cannot retry the same date", async () => {
	const h = harness(daily, at(0));
	await h.scheduler.start();
	h.time(at(1, 15));
	let during;
	h.scheduler.code = async () => {
		during = h.stored();
		assert.equal(during.lastAttemptDate, localDate(at(0)));
		assert.equal(during.succeeded, null);
		const restart = harness(daily, at(1, 16), during);
		await restart.scheduler.start();
		assert.equal(restart.stored().date, localDate(at(0, 0, 6)));
		throw new Error("simulated job failure");
	};
	await h.scheduler.tick();
	assert.equal(h.stored().succeeded, false);
	assert.equal(h.stored().completedAt, at(1, 15));
	const restart = harness(daily, at(1, 16), h.stored());
	await restart.scheduler.start();
	await restart.scheduler.tick();
	assert.equal(restart.calls.length, 0);
	restart.time(at(1, 15, 6));
	await restart.scheduler.tick();
	assert.equal(restart.calls.length, 1);
});

test("suspension across local dates skips old daily choices", async () => {
	const h = harness(daily, at(0));
	await h.scheduler.start();
	h.time(at(3, 0, 6));
	await h.scheduler.tick();
	assert.equal(h.calls.length, 0);
	assert.equal(h.stored().nextRunAt, at(1, 15, 7));
});

test("long delays are chunked and early ticks never invoke the job", async () => {
	const h = harness({ ...interval, min: "50000m", max: "50000m" }, at(0));
	await h.scheduler.start();
	assert.equal(h.timers[0].delay, MAX_TIMEOUT);
	await h.scheduler.tick();
	assert.equal(h.calls.length, 0);
	assert.equal(h.timers[1].delay, MAX_TIMEOUT);
});

test("failed persistence prevents invocation and stops the timer", async () => {
	const h = harness(daily, at(0));
	await h.scheduler.start();
	h.scheduler.cache.set = async () => {
		throw new Error("disk failure");
	};
	h.time(at(1, 15));
	await h.timers[0].callback();
	assert.equal(h.calls.length, 0);
	assert.equal(h.scheduler.stopped, true);
});

test("daily attempt marker survives configuration changes", () => {
	const previous = {
		...plan(daily, undefined, at(0), middle), lastAttemptDate: localDate(at(0))
	};
	const changed = plan({ ...daily, end: "03:00" }, previous, at(1), middle);
	assert.equal(changed.date, localDate(at(0, 0, 6)));
});

test("local calendar windows handle daylight saving transitions", () => {
	const original = process.env.TZ;
	process.env.TZ = "Europe/Rome";
	try {
		for (const [month, day, hours] of [[2, 28, 23], [9, 24, 25]]) {
			const now = new Date(2026, month, day, 12).getTime();
			const options = { ...daily, start: "04:00", end: "05:00" };
			const current = windowFor(now, options);
			const next = windowFor(now, options, 1);
			assert.equal(next.start - current.start, hours * 3600000);
			assert.equal(new Date(plan(options, undefined, now, middle).nextRunAt).getHours(), 4);
		}
		const collapsed = { ...daily, start: "02:30", end: "03:00" };
		const choice = plan(collapsed, undefined, new Date(2026, 2, 29, 0).getTime(), middle);
		assert.equal(choice.date, "2026-03-30");
	}
	finally {
		if (original === undefined) {
			delete process.env.TZ;
		}
		else {
			process.env.TZ = original;
		}
	}
});


test("duration parser supports units, decimals and surrounding whitespace", () => {
	for (const [value, expected] of [
		["1ms", 1],
		["45s", 45000],
		["30m", 1800000],
		["1h", 3600000],
		["1.5h", 5400000],
		["2d", 172800000],
		["1w", 604800000],
		[" 0.5 h ", 1800000]
	]) {
		assert.equal(parseDuration(value), expected);
		assert.equal(sampleDelay({ min: value, max: value }, middle), expected);
	}
	validate("test", { mode: "interval", min: "60m", max: "1h" });
	assert.equal(sampleDelay({ min: "60m", max: "1h" }, middle), 3600000);
	assert.throws(() => validate("test", { mode: "interval", min: "2h", max: "90m" }), /max must be >= min/);
});

test("invalid duration bounds fail with a configuration error", () => {
	for (const value of [
		undefined,
		null,
		30,
		"",
		"30",
		"-1m",
		"0s",
		"0.1ms",
		"NaNh",
		"Infinityh",
		"1e3s",
		"1month",
		"1H",
		"1h30",
		"1h-30m",
		"1h+30m",
		"1h garbage 30m",
		"1h garbage",
		"999999999999999999999w",
		{},
		[]
	]) {
		assert.throws(() => validate("test", { ...interval, min: value }), /crons.test: min and max/);
		assert.throws(() => validate("test", { ...interval, max: value }), /crons.test: min and max/);
	}
});


test("interval safety floor is five minutes regardless of duration unit", () => {
	for (const value of ["5m", "300s", "300000ms", "0.1h", "1d"]) {
		const options = { mode: "interval", min: value, max: value };
		validate("test", options);
		assert.ok(sampleDelay(options, () => 0) >= 300000);
	}
	for (const value of ["1ms", "30s", "299s", "299999ms", "4.999m", "0.08h"]) {
		assert.throws(() => validate("test", { ...interval, min: value }), /at least 5 minutes/);
		assert.throws(() => validate("test", { ...interval, max: value }), /at least 5 minutes/);
	}
});


const overnight = { mode: "daily-window", start: "23:00", end: "01:00" };

test("overnight planning uses the active window on either side of midnight", () => {
	validate("test", overnight);
	assert.equal(plan(overnight, undefined, at(22), middle).nextRunAt, at(0, 0, 6));
	assert.equal(plan(overnight, undefined, at(23, 30), middle).nextRunAt, at(0, 15, 6));
	const active = plan(overnight, undefined, at(0, 30, 6), middle);
	assert.equal(active.nextRunAt, at(0, 45, 6));
	assert.equal(active.windowDate, localDate(at(23)));
	assert.equal(plan(overnight, undefined, at(1, 0, 6), middle).nextRunAt, at(0, 0, 7));
});

test("overnight restart preserves choice and marks the window before invoking", async () => {
	const h = harness(overnight, at(22));
	await h.scheduler.start();
	const restart = harness(overnight, at(23, 30), h.stored());
	await restart.scheduler.start();
	assert.equal(restart.stored().nextRunAt, at(0, 0, 6));
	restart.time(at(0, 0, 6));
	restart.scheduler.code = async () => {
		const crashed = harness(overnight, at(0, 10, 6), restart.stored());
		await crashed.scheduler.start();
		assert.equal(crashed.stored().windowDate, localDate(at(23, 0, 6)));
		assert.ok(crashed.stored().nextRunAt >= at(0, 0, 7));
	};
	await restart.scheduler.tick();
	assert.equal(restart.stored().lastWindowDate, localDate(at(23)));
	assert.equal(restart.stored().lastAttemptDate, localDate(at(0, 0, 6)));
});

test("a pre-midnight attempt cannot run again in the same overnight window", async () => {
	const h = harness(overnight, at(22));
	h.scheduler.random = () => 0;
	await h.scheduler.start();
	h.time(at(23));
	await h.scheduler.tick();
	const restart = harness(overnight, at(0, 30, 6), h.stored());
	await restart.scheduler.start();
	await restart.scheduler.tick();
	assert.equal(restart.calls.length, 0);
	assert.equal(restart.stored().nextRunAt, at(23, 0, 6));
});

test("overdue overnight choices cross midnight only while their window is open", async () => {
	const choice = plan(overnight, undefined, at(22), () => 0);
	for (const timestamp of [at(0, 30, 6), at(1, 0, 6)]) {
		const h = harness(overnight, timestamp, choice);
		await h.scheduler.start();
		await h.scheduler.tick();
		assert.equal(h.calls.length, timestamp < at(1, 0, 6) ? 1 : 0);
	}
});

test("overnight windows use calendar boundaries across DST and year end", () => {
	const original = process.env.TZ;
	process.env.TZ = "Europe/Rome";
	try {
		const options = { ...overnight, end: "04:00" };
		for (const [month, day, hours] of [[2, 28, 4], [9, 24, 6]]) {
			const window = windowFor(new Date(2026, month, day, 22).getTime(), options);
			assert.equal(window.end - window.start, hours * 3600000);
		}
		const window = windowFor(new Date(2026, 11, 31, 22).getTime(), overnight);
		assert.equal(localDate(window.end), "2027-01-01");
	}
	finally {
		if (original === undefined) {
			delete process.env.TZ;
		}
		else {
			process.env.TZ = original;
		}
	}
});


test("compound durations sum all components and preserve interval limits", () => {
	for (const [value, expected] of [
		["1h30m", 5400000],
		["1d 2h", 93600000],
		["1w2d3h4m5s6ms", 788645006],
		[" 1.5h 30m ", 7200000],
		["4m60s", 300000]
	]) {
		assert.equal(parseDuration(value), expected);
		const options = { mode: "interval", min: value, max: value };
		validate("test", options);
		assert.equal(sampleDelay(options, middle), expected);
	}
	validate("test", { mode: "interval", min: "1h30m", max: "90m" });
	assert.throws(() => validate("test", { mode: "interval", min: "1h30m", max: "1h29m" }), /max must be >= min/);
	assert.throws(() => validate("test", { ...interval, min: "4m59s999ms" }), /at least 5 minutes/);
});
