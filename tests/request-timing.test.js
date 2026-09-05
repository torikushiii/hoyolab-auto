const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const RegionalTaskManager = require("../object/regional-task-manager.js");
const HoyoDate = require("../object/date.js");
const Utils = require("../singleton/utils.js");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

afterEach(() => {
	delete globalThis.app;
});

const at = (hour = 21, minute = 0, second = 0, day = 4) => Date.UTC(2026, 9, day, hour, minute, second);

const harness = ({ timestamp = at(), samples = [0.5], accounts = [{ platform: "genshin", region: "os_euro", uid: "1", timezone: 0 }]} = {}) => {
	let time = timestamp;
	let selections = 0;
	const stored = new Map();
	const timers = [];
	const calls = [];
	let active = accounts;
	globalThis.app = {
		Date: HoyoDate,
		Cache: {
			get: async key => structuredClone(stored.get(key)),
			set: async ({ key, value, durable }) => {
				assert.equal(durable, true);
				stored.set(key, structuredClone(value));
			}
		},
		HoyoLab: { getActiveAccounts: () => active, get: () => ({ update: () => {} }) },
		Logger: { debug: () => {}, error: () => {} }
	};
	const manager = (options = {}) => {
		const instance = new RegionalTaskManager({
			now: () => time,
			random: () => samples[selections++ % samples.length],
			setTimer: (callback, delay) => timers.push({ callback, dueAt: time + delay })
		});
		instance.registerTask("TestReminder", 21, 0, async account => {
			assert.equal([...stored.values()].find(state => state.nextRunAt <= time)?.attemptedDate !== undefined, true);
			calls.push({ account, time });
		}, options);
		return instance;
	};
	return { manager,
		stored,
		timers,
		calls,
		accounts,
		time: value => { time = value; },
		active: value => { active = value; },
		selections: () => selections,
		fire: async (index = 0) => {
			time = Math.max(time, timers[index].dueAt);
			await timers[index].callback();
		} };
};

test("reminders select and persist independent times inside the window", async () => {
	const accounts = [1, 2].map(uid => ({ platform: "genshin", region: "os_euro", uid, timezone: 0 }));
	const h = harness({ samples: [0.2, 0.8], accounts });
	const manager = h.manager();
	await Promise.all([manager.executeTasks(), manager.executeTasks()]);
	assert.equal(h.timers.length, 2);
	assert.deepEqual(h.timers.map(timer => timer.dueAt), [at(21, 1), at(21, 4)]);
	assert.equal(h.calls.length, 0);
	await h.fire(0);
	await manager.executeTasks();
	assert.equal(h.timers.length, 2);
	await h.fire(1);
	await h.fire(0);
	assert.equal(h.calls.length, 2);
});

test("restart reuses the selection and cannot repeat a persisted attempt", async () => {
	const h = harness();
	await h.manager().executeTasks();
	const chosen = h.timers[0].dueAt;
	h.time(at(21, 1));
	const restart = h.manager();
	await restart.executeTasks();
	assert.equal(h.timers[1].dueAt, chosen);
	assert.equal(h.selections(), 1);
	await h.fire(1);
	// The durable marker alone is sufficient even if account state was lost.
	delete h.accounts[0].lastTestReminderExecution;
	await h.manager().executeTasks();
	assert.equal(h.timers.length, 2);
	assert.equal(h.calls.length, 1);
	h.time(at(21, 0, 0, 5));
	await restart.executeTasks();
	assert.equal(h.timers.length, 3);
	assert.equal(h.selections(), 2);
});

test("an overdue saved choice runs once while the window remains open", async () => {
	const h = harness();
	await h.manager().executeTasks();
	h.time(at(21, 4));
	await h.manager().executeTasks();
	await h.fire(1);
	assert.equal(h.calls.length, 1);
	assert.equal(h.selections(), 1);
});

test("late startup samples only the remaining window; expired timers are skipped", async () => {
	const h = harness({ timestamp: at(21, 4, 30) });
	await h.manager().executeTasks();
	assert.equal(h.timers[0].dueAt, at(21, 4, 45));
	h.time(at(21, 5));
	await h.fire();
	await h.manager().executeTasks();
	assert.equal(h.calls.length, 0);
	assert.equal(h.timers.length, 1);
	h.time(at(20));
	await h.manager().executeTasks();
	assert.equal(h.timers.length, 1);
});

test("timers skip accounts removed before execution", async () => {
	const h = harness();
	await h.manager().executeTasks();
	h.active([]);
	await h.fire();
	assert.equal(h.calls.length, 0);
});

test("attempt persistence fails closed and failed requests are not repeated", async () => {
	const h = harness();
	const manager = h.manager();
	await manager.executeTasks();
	const save = app.Cache.set;
	app.Cache.set = async () => false;
	await h.fire();
	assert.equal(h.calls.length, 0);
	app.Cache.set = save;
	manager.tasks.get("TestReminder").callback = async () => {
		throw new Error("request failed");
	};
	await manager.executeTasks();
	await h.fire(1);
	await h.manager().executeTasks();
	assert.equal(h.timers.length, 2);
	assert.equal([...h.stored.values()][0].attemptedDate, "2026-10-4");
});

test("an in-flight reminder cannot overlap another poll", async () => {
	const h = harness();
	const manager = h.manager();
	let finish;
	manager.tasks.get("TestReminder").callback = () => new Promise(resolve => {
		finish = resolve;
	});
	await manager.executeTasks();
	const running = h.fire();
	await new Promise(resolve => setImmediate(resolve));
	await manager.executeTasks();
	assert.equal(h.timers.length, 1);
	finish(false);
	await running;
	await manager.executeTasks();
	assert.equal(h.timers.length, 1);
});

test("regional clocks and explicit IANA zones retain their local reminder window", async () => {
	const h = harness({ timestamp: at(13) });
	h.accounts[0].timezone = 480;
	await h.manager().executeTasks();
	assert.equal(h.timers.length, 1);
	assert.equal(h.timers[0].dueAt, at(13, 2, 30));
	const dst = harness({ timestamp: Date.UTC(2026, 2, 29, 19) });
	await dst.manager({ timeZone: "Europe/Rome" }).executeTasks();
	assert.equal(dst.timers[0].dueAt, Date.UTC(2026, 2, 29, 19, 2, 30));
	const winter = harness({ timestamp: Date.UTC(2026, 9, 25, 20) });
	await winter.manager({ timeZone: "Europe/Rome" }).executeTasks();
	assert.equal(winter.timers[0].dueAt, Date.UTC(2026, 9, 25, 20, 2, 30));
});

test("legacy same-day markers prevent another reminder", async () => {
	const h = harness();
	const shifted = new HoyoDate(at()).setTimezoneOffset(0);
	h.accounts[0].lastTestReminderExecution = shifted.toISOString();
	await h.manager().executeTasks();
	assert.equal(h.timers.length, 0);
});

test("positive jitter preserves every existing cooldown and is sampled each time", async () => {
	const utils = new Utils();
	for (const minimum of [1000, 1500, 5000, 6000]) {
		const delays = [];
		for (const sample of [0, 0.5, 0.999999]) {
			await utils.waitWithJitter(minimum, { random: () => sample, wait: async value => delays.push(value) });
		}
		assert.deepEqual(delays, [minimum, minimum + 1000, minimum + 1999]);
	}
});

test("Mimo and Hilichurl retain operation order while applying jitter to cooldowns", async () => {
	for (const [modulePath, currency] of [["../hoyolab-modules/mimo.js", "Stellar Jade"], ["../hoyolab-modules/hilichurl.js", "Primogem"]]) {
		const events = [];
		globalThis.app = {
			Logger: { info: () => {} },
			Utils: { waitWithJitter: async minimum => events.push(minimum) }
		};
		const Module = require(modulePath);
		const instance = new Module({ gameId: 6,
			config: { assets: {} },
			redeemCode: async () => {
				events.push("redeem");
				return { success: true };
			} });
		instance.getGameInfo = async () => ({ success: true, data: { versionId: "v1", points: 100 } });
		instance.getTasks = async () => ({ success: true, data: [{ id: 1, status: 2, taskType: 1, name: "task", point: 10 }]});
		instance.finishTask = async () => {
			events.push("finish");
			return { success: true };
		};
		instance.claimTaskReward = async () => {
			events.push("claim");
			return { success: true };
		};
		instance.getShopItems = async () => ({ success: true, data: [{ id: 1, name: currency, cost: 50, status: 1 }]});
		instance.exchangeItem = async () => {
			events.push("exchange");
			return { success: true, data: { code: "EXAMPLE" } };
		};
		const result = await instance.run({ uid: "1", redeemCode: true });
		assert.equal(result.success, true);
		assert.deepEqual(events, ["finish", 1000, "claim", 1000, "exchange", 5000, "redeem", 1500]);
	}
});

test("both redemption paths retain codes and account order with jittered six-second cooldowns", async () => {
	for (const filename of ["../crons/code-redeem/utils.js", "../crons/gift-code-redeem/index.js"]) {
		const events = [];
		const accounts = [1, 2].map(uid => ({ platform: "genshin", region: "os_euro", uid, redeemCode: true }));
		const cache = new Map([["genshin-code", ["OLD"]]]);
		const app = {
			Utils: { waitWithJitter: async minimum => events.push(minimum) },
			Cache: { get: async key => cache.get(key), set: async ({ key, value }) => cache.set(key, value), delete: async key => cache.delete(key) },
			HoyoLab: { getActiveAccounts: ({ whitelist }) => whitelist === "genshin" ? accounts : [], isExpiredLogin: () => false }
		};
		const absolute = path.join(__dirname, filename);
		const nativeRequire = createRequire(absolute);
		const context = { module: { exports: {} },
			app,
			require: name => {
				if (name === "./genshin" || name === "../code-redeem/genshin.js") {
					return { redeemCodes: async (account, code) => {
						events.push([account.uid, code.code]);
						return { success: true };
					} };
				}
				return nativeRequire(name);
			} };
		vm.runInNewContext(fs.readFileSync(absolute, "utf8"), context);
		if (filename.includes("gift-code")) {
			await context.module.exports.code();
			assert.deepEqual(events, [[1, "GENSHINGIFT"], 6000, [2, "GENSHINGIFT"], 6000]);
		}
		else {
			await context.module.exports.checkAndRedeem({ genshin: [{ code: "EXAMPLE" }]});
			assert.deepEqual(events, [[1, "EXAMPLE"], 6000, [2, "EXAMPLE"], 6000]);
		}
	}
});
