const { setTimeout: sleep } = require("node:timers/promises");

const FINAL_REDEMPTION_ERRORS = new Set([-2001, -2003, -2006, -2017]);
const queues = new Map();
const pendingWrites = new Map();
const nextRequestAt = new Map();
const TEMPORARY_REDEMPTION_ERRORS = new Set([-1071, -2016]);
const REQUEST_INTERVAL = 6000;

const isTemporaryFailure = (res) => res.statusCode !== 200
	|| typeof res.body?.retcode !== "number"
	|| TEMPORARY_REDEMPTION_ERRORS.has(res.body.retcode)
	|| app.HoyoLab.isExpiredLogin(res.body.message);

const accountKey = (gameBiz, account) => `${gameBiz}:${account.region}:${account.uid}`;
const pendingKey = (key) => `redemption:pending:${key}`;

const getPendingCodes = async (gameBiz, account) => {
	const codes = await app.Cache.get(pendingKey(accountKey(gameBiz, account)));
	return Array.isArray(codes) ? codes : [];
};

const updatePending = async (key, code, add) => {
	const previous = pendingWrites.get(key) ?? Promise.resolve();
	const write = previous.catch(() => {}).then(async () => {
		const stored = await app.Cache.get(pendingKey(key));
		const codes = Array.isArray(stored) ? stored : [];
		const updated = add ? [...new Set([...codes, code])] : codes.filter(value => value !== code);
		if (updated.length !== codes.length) {
			await app.Cache.set({ key: pendingKey(key), value: updated });
		}
	});
	pendingWrites.set(key, write);
	try {
		await write;
	}
	finally {
		if (pendingWrites.get(key) === write) {
			pendingWrites.delete(key);
		}
	}
};

// Public codes, event rewards and manual redemptions share the same account cooldown.
const redemptionRequest = async (options, { persist = false } = {}) => {
	const params = options.searchParams;
	const key = accountKey(params.game_biz, params);
	const code = String(params.cdkey).toUpperCase();
	const previous = queues.get(key) ?? Promise.resolve();
	const saved = persist ? updatePending(key, code, true) : Promise.resolve();
	const request = Promise.allSettled([previous, saved]).then(async ([, savedResult]) => {
		if (savedResult.status === "rejected") {
			throw savedResult.reason;
		}

		let res;
		for (let attempt = 0; attempt < 3; attempt++) {
			const delay = (nextRequestAt.get(key) ?? 0) - Date.now();
			if (delay > 0) {
				await sleep(delay);
			}
			try {
				res = await app.Got("HoYoLab", {
					...options,
					searchParams: { ...params, ...(params.t !== undefined && { t: Date.now() }) }
				});
			}
			finally {
				nextRequestAt.set(key, Date.now() + REQUEST_INTERVAL);
			}

			if (res.statusCode !== 200 || res.body?.retcode !== -2016) {
				break;
			}
			const seconds = Number(res.body.message?.match(/(\d+(?:\.\d+)?)\s*second/i)?.[1]);
			const cooldown = Number.isFinite(seconds) ? seconds * 1000 + 1000 : REQUEST_INTERVAL;
			nextRequestAt.set(key, Date.now() + Math.max(REQUEST_INTERVAL, cooldown));
		}

		if (!isTemporaryFailure(res)) {
			await updatePending(key, code, false);
		}
		return res;
	});
	queues.set(key, request);
	try {
		return await request;
	}
	finally {
		if (queues.get(key) === request) {
			queues.delete(key);
		}
	}
};

const waitForQueue = async (gameBiz, account) => {
	const key = accountKey(gameBiz, account);
	let previous;
	let current = queues.get(key);
	while (current && current !== previous) {
		await current.catch(() => {});
		previous = current;
		current = queues.get(key);
	}
};

module.exports = redemptionRequest;
module.exports.getPendingCodes = getPendingCodes;
module.exports.waitForQueue = waitForQueue;
module.exports.FINAL_REDEMPTION_ERRORS = FINAL_REDEMPTION_ERRORS;
