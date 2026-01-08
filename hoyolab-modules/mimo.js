/**
 * Traveling Mimo - Shared module for all supported games
 * Handles mission completion, point management, and reward exchange
 *
 * Supported Games:
 * - game_id 2: Genshin Impact (uses /qiuqiu/ endpoint prefix with underscores)
 * - game_id 6: Honkai: Star Rail
 * - game_id 8: Zenless Zone Zero
 */

const { setTimeout: sleep } = require("node:timers/promises");
const MIMO_BASE_URL = "https://sg-public-api.hoyolab.com/event/e2023mimotravel";

// Task status enum matching HoYoLab API
const MimoTaskStatus = {
	FINISHED: 1, // Completed, ready to claim
	ONGOING: 2, // Not yet completed
	CLAIMED: 3 // Already claimed
};

// Task types that can be auto-completed via API
const FinishableTaskTypes = [1, 2]; // FINISHABLE, VISIT

// Shop item status
const MimoShopItemStatus = {
	EXCHANGEABLE: 1, // Available to buy
	NOT_EXCHANGEABLE: 2, // Can't buy
	LIMIT_REACHED: 3, // Personal limit reached
	SOLD_OUT: 4 // Out of stock
};

module.exports = class TravelingMimo {
	/** @type {import("./template")} */
	#instance;
	#logo;
	#color;
	#gameId;
	#isGenshin;

	constructor (instance, options = {}) {
		this.#instance = instance;
		this.#logo = options.logo;
		this.#color = options.color;
		this.#gameId = instance.gameId;
		this.#isGenshin = (instance.gameId === 2);
	}

	#buildEndpoint (endpoint) {
		if (this.#isGenshin) {
			return `${MIMO_BASE_URL}/qiuqiu/${endpoint.replace(/-/g, "_")}`;
		}
		return `${MIMO_BASE_URL}/${endpoint}`;
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

		return await app.Got("HoYoLab", requestOptions);
	}

	async getGameInfo (accountData) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("index", {
			params: { lang: "en-us" },
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: "Failed to fetch Mimo game info",
				args: { body: res.body }
			});
			return { success: false };
		}

		// Handle different response structures for Genshin vs other games
		let gameList;
		if (this.#isGenshin && res.body.data.act_list) {
			gameList = res.body.data.act_list.map(item => item.act_info);
		}
		else {
			gameList = res.body.data.list;
		}

		const game = gameList?.find(g => g.game_id === this.#gameId);
		if (!game) {
			return { success: false, message: `${this.#instance.fullName} Mimo event not active` };
		}

		return {
			success: true,
			data: {
				gameId: game.game_id,
				versionId: game.version_id,
				points: game.point,
				startTime: game.start_time,
				endTime: game.end_time
			}
		};
	}

	async getTasks (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("task-list", {
			params: {
				lang: "en-us",
				game_id: this.#gameId,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: "Failed to fetch Mimo tasks",
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
				game_id: this.#gameId,
				lang: "en-us",
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: "Failed to finish Mimo task",
				args: { taskId, body: res.body }
			});
			return { success: false, message: res.body?.message };
		}

		return { success: true };
	}

	async claimTaskReward (accountData, taskId, versionId) {
		const cookieData = this.#getCookieData(accountData);

		// Genshin uses POST for receive-point, others use GET
		const method = this.#isGenshin ? "POST" : "GET";
		const requestParams = {
			task_id: taskId,
			game_id: this.#gameId,
			lang: "en-us",
			version_id: versionId
		};

		const res = await this.#request("receive-point", {
			method,
			...(method === "GET" ? { params: requestParams } : { data: requestParams }),
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: "Failed to claim Mimo task reward",
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
				game_id: this.#gameId,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: "Failed to fetch Mimo shop items",
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
				game_id: this.#gameId,
				lang: "en-us",
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: "Failed to exchange Mimo item",
				args: { awardId, body: res.body }
			});
			return { success: false, message: res.body?.message };
		}

		return {
			success: true,
			data: {
				code: res.body.data.exchange_code
			}
		};
	}

	#getPremiumCurrencyName () {
		switch (this.#gameId) {
			case 2: return "primogem";
			case 6: return "stellar jade";
			case 8: return "polychrome";
			default: return "currency";
		}
	}

	async run (accountData) {
		const results = {
			tasksFinished: [],
			tasksClaimed: [],
			itemsExchanged: [],
			codesRedeemed: [],
			errors: [],
			points: 0,
			shopStatus: []
		};

		const gameInfo = await this.getGameInfo(accountData);
		if (!gameInfo.success) {
			return { success: false, message: gameInfo.message || "Failed to get Mimo game info" };
		}

		const { versionId } = gameInfo.data;
		results.points = gameInfo.data.points;

		app.Logger.info(`${this.#instance.fullName}:Mimo`, `(${accountData.uid}) Starting Mimo automation - Current points: ${results.points}`);

		const tasks = await this.getTasks(accountData, versionId);
		if (tasks.success) {
			for (const task of tasks.data) {
				if (task.status === MimoTaskStatus.ONGOING && FinishableTaskTypes.includes(task.taskType)) {
					const finishResult = await this.finishTask(accountData, task.id, versionId);
					if (finishResult.success) {
						results.tasksFinished.push(task.name);
						task.status = MimoTaskStatus.FINISHED;
						app.Logger.info(`${this.#instance.fullName}:Mimo`, `(${accountData.uid}) Finished task: ${task.name}`);
					}
					await sleep(1000);
				}
				if (task.status === MimoTaskStatus.FINISHED) {
					const claimResult = await this.claimTaskReward(accountData, task.id, versionId);
					if (claimResult.success) {
						results.tasksClaimed.push({ name: task.name, points: task.point });
						results.points += task.point;
						app.Logger.info(`${this.#instance.fullName}:Mimo`, `(${accountData.uid}) Claimed ${task.point} points for: ${task.name}`);
					}
					await sleep(1000);
				}
			}
		}

		const updatedGameInfo = await this.getGameInfo(accountData);
		if (updatedGameInfo.success) {
			results.points = updatedGameInfo.data.points;
		}

		const shopItems = await this.getShopItems(accountData, versionId);
		if (shopItems.success) {
			const currencyName = this.#getPremiumCurrencyName();

			const currencyItems = shopItems.data
				.filter(item => item.name.toLowerCase().includes(currencyName))
				.sort((a, b) => b.cost - a.cost);

			results.shopStatus = shopItems.data.map(item => ({
				name: item.name,
				cost: item.cost,
				stock: item.stock,
				status: item.status,
				nextRefreshTime: item.nextRefreshTime
			}));

			for (const item of currencyItems) {
				if (item.status !== MimoShopItemStatus.EXCHANGEABLE) {
					continue;
				}

				if (results.points < item.cost) {
					continue;
				}

				const exchangeResult = await this.exchangeItem(accountData, item.id, versionId);
				if (exchangeResult.success && exchangeResult.data.code) {
					const code = exchangeResult.data.code;
					results.itemsExchanged.push({ name: item.name, cost: item.cost, code });
					results.points -= item.cost;

					app.Logger.info(`${this.#instance.fullName}:Mimo`, `(${accountData.uid}) Exchanged ${item.name} for code: ${code}`);

					if (accountData.redeemCode) {
						await sleep(2000);
						const redeemResult = await this.#instance.redeemCode(accountData, code);
						if (redeemResult.success) {
							results.codesRedeemed.push(code);
							app.Logger.info(`${this.#instance.fullName}:Mimo`, `(${accountData.uid}) Redeemed code: ${code}`);
						}
						else {
							results.errors.push(`Failed to redeem code ${code}: ${redeemResult.message}`);
						}
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

		const currencyName = this.#getPremiumCurrencyName();
		const currencyItem = shopItems.data.find(i => i.name.toLowerCase().includes(currencyName));
		if (!currencyItem) {
			return { success: false, message: `No ${currencyName} items found` };
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
