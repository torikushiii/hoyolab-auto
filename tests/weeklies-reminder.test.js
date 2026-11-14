const assert = require("node:assert/strict");
const test = require("node:test");
const RegionalTaskManager = require("../object/regional-task-manager.js");

test("weekly reminders skip unsupported games and continue through supported accounts", async (t) => {
	const previousApp = global.app;
	const cronPath = require.resolve("../crons/weeklies-reminder/index.js");
	t.after(() => {
		global.app = previousApp;
		delete require.cache[cronPath];
	});
	const accounts = ["tot", "honkai", "genshin", "starrail", "nap"].map(platform => ({
		platform, uid: platform, timezone: 0
	}));
	const notesCalls = [];
	const updated = [];
	global.app = {
		RegionalTaskManager,
		Date: class extends Date {
			constructor (value = "2026-11-08T21:00:00Z") { super(value); }
			get hours () { return 21; }
			setTimezoneOffset () {}
		},
		Logger: { debug () {} },
		HoyoLab: {
			getActiveAccounts: ({ blacklist = []} = {}) => accounts.filter(account => !blacklist.includes(account.platform)),
			get: platform => ({
				notes: async () => {
					assert.ok(!["tot", "honkai"].includes(platform), "unsupported Notes must not be called");
					notesCalls.push(platform);
					return { success: false };
				},
				update: account => updated.push(account.platform)
			})
		}
	};
	delete require.cache[cronPath];
	const cron = require(cronPath);
	await cron.code();
	assert.deepEqual(notesCalls, ["genshin", "starrail", "nap"]);
	assert.deepEqual(updated, ["genshin", "starrail", "nap"]);
	assert.equal(accounts[0].lastWeekliesReminderExecution, undefined);
	assert.equal(accounts[1].lastWeekliesReminderExecution, undefined);

	// Preserve the existing per-day deduplication and disabled-account behavior.
	await cron.code();
	assert.equal(notesCalls.length, 3);
	for (const account of accounts) {
		delete account.lastWeekliesReminderExecution;
		account.weekliesCheck = false;
	}
	await cron.code();
	assert.equal(notesCalls.length, 3);
});
