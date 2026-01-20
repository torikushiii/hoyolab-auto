/**
 * Hilichurl Machine Workshop - Genshin Impact exclusive web event
 * Handles mission completion, point management, and reward exchange
 *
 * This is separate from the Traveling Mimo system as Genshin uses
 * a different API structure (/qiuqiu/ endpoint prefix with underscores)
 * and has no lottery feature.
 */

const { setTimeout: sleep } = require("node:timers/promises");
const HILICHURL_BASE_URL = "https://sg-public-api.hoyolab.com/event/e2023mimotravel/qiuqiu";

// Task status enum matching HoYoLab API
const TaskStatus = {
	FINISHED: 1, // Completed, ready to claim
	ONGOING: 2, // Not yet completed
	CLAIMED: 3 // Already claimed
};

// Task types that can be auto-completed via API
const FinishableTaskTypes = [1, 2]; // FINISHABLE, VISIT

// Shop item status
const ShopItemStatus = {
	EXCHANGEABLE: 1, // Available to buy
	NOT_EXCHANGEABLE: 2 // Can't buy (out of stock, etc.)
};

module.exports = class HilichurlWorkshop {
	/** @type {import("./template")} */
	#instance;
	#logo;
	#color;

	constructor (instance, options = {}) {
		this.#instance = instance;
		this.#logo = options.logo;
		this.#color = options.color;
	}

	#buildEndpoint (endpoint) {
		// Genshin uses underscores instead of hyphens
		return `${HILICHURL_BASE_URL}/${endpoint.replace(/-/g, "_")}`;
	}

	async #request (endpoint, options = {}) {
		const { method = "GET", params = {}, data = null, cookie } = options;

		const url = this.#buildEndpoint(endpoint);

		const requestOptions = {
			url,
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				Cookie: cookie
			}
		};

		if (method === "GET") {
			requestOptions.searchParams = params;
		}
		else {
			requestOptions.method = "POST";
			requestOptions.json = data || params;
		}

		// Retry logic with exponential backoff for rate limits
		const maxRetries = 10;
		const baseDelay = 500; // 500ms initial delay
		const maxDelay = 30000; // 30s max delay

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			const res = await app.Got("HoYoLab", requestOptions);

			// Check for rate limit errors:
			// - retcode -500004 = VisitsTooFrequently (JSON response)
			// - HTTP 429 = Too Many Requests
			// - Body contains "Too Many Requests" string
			const isRateLimited = res.body?.retcode === -500004
				|| res.statusCode === 429
				|| (typeof res.body === "string" && res.body.includes("Too Many Requests"));

			if (isRateLimited) {
				if (attempt === maxRetries) {
					app.Logger.warn(`${this.#instance.fullName}:Hilichurl`, `Rate limited after ${maxRetries} attempts, giving up`);
					return res;
				}

				const maxWait = Math.min(baseDelay * (2 ** attempt), maxDelay);
				const totalDelay = Math.floor(baseDelay + Math.random() * (maxWait - baseDelay));

				app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `Rate limited, retrying in ${totalDelay}ms (attempt ${attempt}/${maxRetries})`);
				await sleep(totalDelay);
				continue;
			}

			return res;
		}
	}

	async getGameInfo (accountData) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("index", {
			params: { lang: "en-us" },
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Hilichurl`, {
				message: "Failed to fetch Hilichurl Workshop info",
				args: { body: res.body }
			});
			return { success: false };
		}

		// Genshin uses act_list[].act_info structure
		const gameList = res.body.data.act_list?.map(item => item.act_info) ?? [];
		const game = gameList.find(g => g.game_id === 2); // Genshin = game_id 2

		if (!game) {
			return { success: false, message: "Hilichurl Workshop event not active for Genshin Impact" };
		}

		return {
			success: true,
			data: {
				gameId: game.game_id,
				versionId: game.version_id,
				points: game.point,
				startTime: game.start_time,
				endTime: game.end_time,
				hasExchange: game.exchange_exist,
				hasLottery: game.lottery_exist
			}
		};
	}

	async getTasks (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("task-list", {
			params: {
				lang: "en-us",
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Hilichurl`, {
				message: "Failed to fetch Hilichurl tasks",
				args: { body: res.body }
			});
			return { success: false };
		}

		return {
			success: true,
			data: res.body.data.task_list.map(task => ({
				id: task.task_id,
				name: task.task_name,
				timeType: task.time_type, // 0=permanent, 1=daily, 2=weekly
				point: task.point,
				progress: task.progress,
				totalProgress: task.total_progress,
				status: task.status,
				taskType: task.task_type,
				jumpUrl: task.jump_url,
				afUrl: task.af_url
			}))
		};
	}

	async finishTask (accountData, taskId, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("finish-task", {
			method: "POST",
			data: {
				task_id: taskId,
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Hilichurl`, {
				message: "Failed to finish Hilichurl task",
				args: { taskId, body: res.body }
			});
			return { success: false, message: res.body?.message };
		}

		return { success: true };
	}

	async claimTaskReward (accountData, taskId, versionId) {
		const cookieData = this.#getCookieData(accountData);

		// Genshin uses POST for receive-point
		const res = await this.#request("receive-point", {
			method: "POST",
			data: {
				task_id: taskId,
				game_id: 2,
				lang: "en-us",
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Hilichurl`, {
				message: "Failed to claim Hilichurl task reward",
				args: { taskId, body: res.body }
			});
			return { success: false, message: res.body?.message };
		}

		return { success: true };
	}

	async getShopItems (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("exchange-list", {
			params: {
				lang: "en-us",
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Hilichurl`, {
				message: "Failed to fetch Hilichurl shop items",
				args: { body: res.body }
			});
			return { success: false };
		}

		return {
			success: true,
			data: res.body.data.exchange_award_list.map(item => ({
				id: item.award_id,
				name: item.name,
				icon: item.icon,
				cost: item.cost,
				stock: item.stock,
				status: item.status,
				userCount: item.user_count,
				nextRefreshTime: item.next_refresh_time, // seconds until restock
				expireDay: item.expire_day
			}))
		};
	}

	async exchangeItem (accountData, awardId, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("exchange", {
			method: "POST",
			data: {
				award_id: awardId,
				game_id: 2,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Hilichurl`, {
				message: "Failed to exchange Hilichurl item",
				args: { awardId, body: res.body }
			});
			return { success: false, message: res.body?.message };
		}

		return {
			success: true,
			data: {
				code: res.body.data.exchange_code,
				type: res.body.data.type,
				awardId: res.body.data.award_id
			}
		};
	}

	async run (accountData) {
		const results = {
			tasksFinished: [],
			tasksClaimed: [],
			freeItemsClaimed: [],
			itemsExchanged: [],
			codesRedeemed: [],
			codesObtained: [],
			errors: [],
			points: 0,
			shopStatus: []
		};

		const gameInfo = await this.getGameInfo(accountData);
		if (!gameInfo.success) {
			return { success: false, message: gameInfo.message || "Failed to get Hilichurl Workshop info" };
		}

		const { versionId } = gameInfo.data;
		results.points = gameInfo.data.points;

		app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `(${accountData.uid}) Starting Hilichurl Workshop automation - Current points: ${results.points}`);

		// Process tasks
		const tasks = await this.getTasks(accountData, versionId);
		if (tasks.success) {
			for (const task of tasks.data) {
				// Try to auto-complete finishable tasks
				if (task.status === TaskStatus.ONGOING && FinishableTaskTypes.includes(task.taskType)) {
					const finishResult = await this.finishTask(accountData, task.id, versionId);
					if (finishResult.success) {
						results.tasksFinished.push(task.name);
						task.status = TaskStatus.FINISHED;
						app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `(${accountData.uid}) Finished task: ${task.name}`);
					}
					await sleep(1000);
				}

				// Claim completed tasks
				if (task.status === TaskStatus.FINISHED) {
					const claimResult = await this.claimTaskReward(accountData, task.id, versionId);
					if (claimResult.success) {
						results.tasksClaimed.push({ name: task.name, points: task.point });
						results.points += task.point;
						app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `(${accountData.uid}) Claimed ${task.point} points for: ${task.name}`);
					}
					await sleep(1000);
				}
			}
		}

		// Refresh points after claiming tasks
		const updatedGameInfo = await this.getGameInfo(accountData);
		if (updatedGameInfo.success) {
			results.points = updatedGameInfo.data.points;
		}

		// Process shop exchanges
		const shopItems = await this.getShopItems(accountData, versionId);
		if (shopItems.success) {
			results.shopStatus = shopItems.data.map(item => ({
				name: item.name,
				cost: item.cost,
				stock: item.stock,
				status: item.status,
				nextRefreshTime: item.nextRefreshTime
			}));

			const freeItems = shopItems.data.filter(item => item.cost === 0 && item.status === ShopItemStatus.EXCHANGEABLE);
			for (const item of freeItems) {
				const exchangeResult = await this.exchangeItem(accountData, item.id, versionId);
				if (exchangeResult.success) {
					results.freeItemsClaimed.push(item.name);
					app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `(${accountData.uid}) Claimed free item: ${item.name}`);
				}
				await sleep(1000);
			}

			const currencyItems = shopItems.data
				.filter(item => item.name.toLowerCase().includes("primogem"))
				.sort((a, b) => b.cost - a.cost);

			for (const item of currencyItems) {
				if (item.status !== ShopItemStatus.EXCHANGEABLE) {
					continue;
				}

				if (results.points < item.cost) {
					continue;
				}

				const exchangeResult = await this.exchangeItem(accountData, item.id, versionId);
				if (exchangeResult.success) {
					const code = exchangeResult.data.code;
					results.itemsExchanged.push({ name: item.name, cost: item.cost, code });
					results.points -= item.cost;

					app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `(${accountData.uid}) Exchanged ${item.name}${code ? ` for code: ${code}` : ""}`);

					// Check if auto-redeem is enabled (hilichurl.redeem defaults to true for backward compatibility)
					const shouldRedeem = accountData.redeemCode && (accountData.hilichurl?.redeem !== false);

					if (code && shouldRedeem) {
						await sleep(5000);
						const redeemResult = await this.#instance.redeemCode(accountData, code);
						if (redeemResult.success) {
							results.codesRedeemed.push(code);
							app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `(${accountData.uid}) Redeemed code: ${code}`);
						}
						else {
							results.errors.push(`Failed to redeem code ${code}: ${redeemResult.message}`);
						}
					}
					else if (code) {
						// Code obtained but not auto-redeemed
						results.codesObtained.push(code);
						app.Logger.info(`${this.#instance.fullName}:Hilichurl`, `(${accountData.uid}) Code obtained (not auto-redeemed): ${code}`);
					}
				}

				await sleep(1500);
			}
		}

		return {
			success: true,
			data: {
				...results,
				assets: {
					...this.#instance.config.assets,
					logo: this.#logo,
					color: this.#color
				}
			}
		};
	}

	async getNextRestockTime (accountData) {
		const gameInfo = await this.getGameInfo(accountData);
		if (!gameInfo.success) {
			return { success: false };
		}

		const shopItems = await this.getShopItems(accountData, gameInfo.data.versionId);
		if (!shopItems.success) {
			return { success: false };
		}

		const currencyItem = shopItems.data.find(i => i.name.toLowerCase().includes("primogem"));
		if (!currencyItem) {
			return { success: false, message: "No primogem items found" };
		}

		return {
			success: true,
			data: {
				nextRefreshTime: currencyItem.nextRefreshTime,
				nextRefreshDate: currencyItem.nextRefreshTime > 0
					? new Date(Date.now() + (currencyItem.nextRefreshTime * 1000))
					: null
			}
		};
	}

	#getCookieData (accountData) {
		return app.HoyoLab.parseCookie(accountData.cookie, {
			whitelist: [
				"ltoken_v2",
				"ltmid_v2",
				"ltuid_v2",
				"cookie_token_v2",
				"account_mid_v2",
				"account_id_v2"
			]
		});
	}
};
