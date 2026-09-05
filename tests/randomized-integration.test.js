const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const JSON5 = require("json5");
const schedulerModule = require("../crons/randomized-scheduler.js");

const initialize = (crons) => {
	const fixed = [];
	const context = {
		module: { exports: {} },
		app: {
			Utils: { convertCase: name => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) },
			Logger: { info: () => {} }
		},
		require: (name) => {
			if (name === "../localization/index.js") {
				return require(name);
			}
			if (name === "cron") {
				return { CronJob: class {
					constructor (expression, code) {
						Object.assign(this, { expression, code });
						fixed.push(this);
					}

					start () { this.started = true; }
				} };
			}
			if (name === "../config.js") {
				return { crons };
			}
			if (name === "./randomized-scheduler.js") {
				return schedulerModule;
			}
			return { name: name.split("/")[1], expression: "0 * * * * *", code: () => "existing code" };
		}
	};
	vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../crons/index.js"), "utf8"), context);
	return { jobs: context.module.exports.initCrons(), fixed };
};

test("legacy strings and cron mode preserve fixed definitions and overrides", () => {
	for (const checkIn of ["0 0 1 * * *", { mode: "cron", expression: "0 0 1 * * *" }]) {
		const result = initialize({ checkIn });
		assert.equal(result.fixed.length, 14);
		assert.equal(result.fixed[0].expression, "0 0 1 * * *");
		assert.ok(result.fixed.every(job => job.started));
		assert.equal(result.fixed[0].code(), "existing code");
	}
	assert.equal(initialize({}).fixed.length, 14);
	assert.throws(() => initialize({ expedition: { mode: "interval", min: "299s", max: "1h" } }), /crons.expedition:.*at least 5 minutes/);
	assert.equal(initialize({ checkIn: "" }).fixed[0].expression, "0 * * * * *");
});

test("randomized modes replace selected crons and respect existing filters", () => {
	const settings = { checkIn: { mode: "interval", min: "30m", max: "1h" } };
	const result = initialize(settings);
	assert.equal(result.fixed.length, 13);
	assert.ok(result.jobs[0].job instanceof schedulerModule.RandomizedScheduler);
	assert.equal(result.jobs[0].job.stopped, true); // Started only after clients initialize.
	assert.equal(result.jobs[0].job.code(), "existing code");
	assert.equal(initialize({ ...settings, blacklist: ["check-in"]}).jobs.length, 13);
	assert.equal(initialize({ ...settings, whitelist: ["expedition"]}).fixed.length, 1);
	assert.throws(() => initialize({ blacklist: ["check-in"], whitelist: ["expedition"]}));
	assert.throws(() => initialize({ checkIn: { mode: "unknown" } }), /mode must be/);
	assert.throws(() => initialize({ randomization: settings }), /Move crons.randomization/);
	assert.equal(initialize({ checkIn: { mode: "daily-window", start: "23:00", end: "01:00" } }).fixed.length, 13);
});

test("default config uses cron objects with unchanged expressions", () => {
	const config = JSON5.parse(fs.readFileSync(path.join(__dirname, "../default.config.json5"), "utf8"));
	const result = initialize(config.crons);
	assert.equal(result.fixed.length, 14);
	assert.equal(result.fixed[0].expression, "0 0 0 * * *");
	assert.equal(result.fixed[3].expression, "0 */30 * * * *");
	assert.equal(Object.hasOwn(config.crons, "randomization"), false);
});

test("excluded jobs do not validate their unused schedules or jitter", () => {
	const invalidSchedules = ["invalid", { mode: "unknown" }, { mode: "interval", min: "1s", max: "1h" }];
	for (const checkIn of invalidSchedules) {
		assert.equal(initialize({ whitelist: ["expedition"], checkIn }).jobs.length, 1);
		assert.equal(initialize({ blacklist: ["check-in"], checkIn }).jobs.length, 13);
		assert.throws(() => initialize({ checkIn }), /crons.checkIn/);
	}
	assert.equal(initialize({ whitelist: ["expedition"], mimo: { mode: "interval", min: "30m", max: "1h" }, mimoJitter: 10 }).jobs.length, 1);
});

test("internal fixed schedules ignore legacy strings and reject schedule objects", () => {
	for (const [name, key] of [["dailies-reminder", "dailiesReminder"], ["howl-scratch-card", "howlScratchCard"], ["weeklies-reminder", "weekliesReminder"]]) {
		const result = initialize({ whitelist: [name], [key]: "ignored invalid legacy expression" });
		assert.equal(result.fixed.length, 1);
		assert.equal(result.fixed[0].expression, "0 * * * * *");
		assert.equal(result.fixed[0].code(), "existing code");
		for (const options of [{ mode: "interval", min: "30m", max: "1h" }, { mode: "daily-window", start: "00:30", end: "02:00" }, { mode: "cron", expression: "0 0 1 * * *" }]) {
			assert.throws(() => initialize({ whitelist: [name], [key]: options }), /built-in fixed schedule/);
			assert.equal(initialize({ whitelist: ["expedition"], [key]: options }).jobs.length, 1);
		}
	}
});

test("setup exports imported advanced cron settings and clears them on a new import", () => {
	const html = fs.readFileSync(path.join(__dirname, "../setup/config/index.html"), "utf8");
	const elements = new Map();
	const parseElements = (markup) => {
		for (const [, id] of markup.matchAll(/\bid="([^"]+)"/g)) {
			assert.equal(elements.has(id), false, `Duplicate element ID: ${id}`);
			elements.set(id, { value: "", placeholder: "", addEventListener: () => {} });
		}
	};
	parseElements(html.split("<script>")[0]);
	Object.defineProperty(elements.get("cronSchedules"), "innerHTML", { set: parseElements });
	let exported;
	const document = {
		getElementById: id => elements.get(id),
		querySelectorAll: () => [],
		createElement: () => ({ click: () => {} }),
		body: { appendChild: () => {}, removeChild: () => {} }
	};
	const context = vm.createContext({
		document,
		HoyoLabI18n: require("../localization/index.js"),
		updateLanguage: () => {},
		Blob,
		URL: { createObjectURL: () => "blob:test" },
		JSON5: { stringify: value => {
			exported = JSON5.parse(JSON5.stringify(value));
			return "";
		} }
	});
	vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
	const crons = {
		expedition: { mode: "interval", min: "5m30s", max: "1h30m" },
		checkIn: { mode: "daily-window", start: "00:30", end: "02:00" },
		stamina: { mode: "cron", expression: "0 */30 * * * *" },
		mimoJitter: 10,
		hilichurlJitter: 20,
		mimo: { mode: "cron", expression: "0 0 */6 * * *" },
		futureOption: { keep: true }
	};
	context.applyCronConfig(crons);
	context.generateConfig();
	for (const [key, value] of Object.entries(crons)) {
		assert.deepEqual(exported.crons[key], value);
	}
	context.applyCronConfig({});
	context.generateConfig();
	assert.equal(exported.crons.expedition.mode, "cron");
	assert.equal(Object.hasOwn(exported.crons, "futureOption"), false);
	context.applyCronConfig({ checkIn: "0 0 3 * * *" });
	context.generateConfig();
	assert.deepEqual(exported.crons.checkIn, { mode: "cron", expression: "0 0 3 * * *" });
	document.getElementById("checkInCron").value = "0 0 4 * * *";
	context.generateConfig();
	assert.deepEqual(exported.crons.checkIn, { mode: "cron", expression: "0 0 4 * * *" });
	document.getElementById("checkInMode").value = "interval";
	context.updateCronFields("checkIn");
	assert.equal(document.getElementById("checkInCronFields").hidden, true);
	assert.equal(document.getElementById("checkInIntervalFields").hidden, false);
	context.generateConfig();
	assert.deepEqual(exported.crons.checkIn, { mode: "interval", min: "30m", max: "1h" });
	document.getElementById("checkInMode").value = "daily-window";
	context.generateConfig();
	assert.deepEqual(exported.crons.checkIn, { mode: "daily-window", start: "00:30", end: "02:00" });
	context.applyCronConfig({ checkIn: { mode: "daily-window", start: "23:00", end: "01:00" } });
	context.generateConfig();
	assert.deepEqual(exported.crons.checkIn, { mode: "daily-window", start: "23:00", end: "01:00" });
});

test("real cache persists scheduler state before returning across process restart", () => {
	const directory = fs.mkdtempSync("/tmp/hoyolab-scheduler-test-");
	const cachePath = path.join(__dirname, "../singleton/cache.js");
	try {
		const write = `const Cache = require(${JSON.stringify(cachePath)});
		(async () => {
			const cache = new Cache();
			await Promise.all(Array.from({ length: 10 }, (_, i) => cache.set({ key: 'game:' + i, value: i })));
			await cache.set({ key: 'scheduler:checkIn', value: { lastAttemptDate: '2026-09-05' }, durable: true });
			process.exit(0);
		})();`;
		execFileSync(process.execPath, ["-e", write], { cwd: directory });
		const read = `const Cache = require(${JSON.stringify(cachePath)});
		new Cache().get('scheduler:checkIn').then(value => console.log(JSON.stringify(value)));`;
		const value = execFileSync(process.execPath, ["-e", read], { cwd: directory, encoding: "utf8" });
		assert.deepEqual(JSON.parse(value), { lastAttemptDate: "2026-09-05" });
	}
	finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});
