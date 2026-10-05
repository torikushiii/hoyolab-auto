const { t } = require("../localization/index.js");

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
	NOT_EXCHANGEABLE: 2, // Waiting for shared stock to be replenished
	LIMIT_REACHED: 3, // Personal limit reached
	SOLD_OUT: 4 // Out of stock
};

const MimoPolicyMode = {
	ALWAYS: "always",
	CONDITIONAL: "conditional",
	NEVER: "never"
};

const MimoItemCategory = {
	PREMIUM_CURRENCY: "premiumCurrency",
	GAME_MATERIALS: "gameMaterials",
	HOYOLAB_COSMETICS: "hoyolabCosmetics"
};

const DefaultShopPolicy = [
	{ category: MimoItemCategory.PREMIUM_CURRENCY, mode: MimoPolicyMode.ALWAYS },
	{ category: MimoItemCategory.GAME_MATERIALS, mode: MimoPolicyMode.NEVER },
	{ category: MimoItemCategory.HOYOLAB_COSMETICS, mode: MimoPolicyMode.NEVER }
];

const CosmeticKeywords = [
	"avatar",
	"frame",
	"background",
	"homepage",
	"comment decoration",
	"profile page",
	"decoration",
	"chat bubble",
	"namecard"
];

const ShopPlanFormatVersion = 2;
const RunningAccounts = new Set();

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
					app.Logger.warn(`${this.#instance.fullName}:Mimo`, t `Rate limited after ${maxRetries} attempts, giving up`);
					return res;
				}

				const maxWait = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
				const totalDelay = Math.floor(baseDelay + Math.random() * (maxWait - baseDelay));

				app.Logger.info(`${this.#instance.fullName}:Mimo`, t `Rate limited, retrying in ${totalDelay}ms (attempt ${attempt}/${maxRetries})`);
				await sleep(totalDelay);
				continue;
			}

			return res;
		}
	}

	async getGameInfo (accountData) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("index", {
			params: { lang: app.Config.get("language") || "en-us" },
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: t("Failed to fetch Mimo game info"),
				args: { body: res.body }
			});
			return {
				success: false,
				message: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode) || res.body.message || t("Failed to fetch Mimo game info")
			};
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
			return { success: false, message: t `${this.#instance.fullName} Mimo event not active` };
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
				lang: app.Config.get("language") || "en-us",
				game_id: this.#gameId,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: t("Failed to fetch Mimo tasks"),
				args: { body: res.body }
			});
			return {
				success: false,
				message: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode) || res.body.message || t("Failed to fetch Mimo tasks")
			};
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
				lang: app.Config.get("language") || "en-us",
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: t("Failed to finish Mimo task"),
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
			lang: app.Config.get("language") || "en-us",
			version_id: versionId
		};

		const res = await this.#request("receive-point", {
			method,
			...(method === "GET" ? { params: requestParams } : { data: requestParams }),
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: t("Failed to claim Mimo task reward"),
				args: { taskId, body: res.body }
			});
			return { success: false, message: res.body?.message };
		}

		return { success: true };
	}

	async getShopItems (accountData, versionId, language = app.Config.get("language") || "en-us") {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("exchange-list", {
			params: {
				lang: language,
				game_id: this.#gameId,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: t("Failed to fetch Mimo shop items"),
				args: { body: res.body }
			});
			return {
				success: false,
				message: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode) || res.body.message || t("Failed to fetch Mimo shop items")
			};
		}

		const items = res.body.data.exchange_award_list.map(item => ({
			id: item.award_id,
			name: item.name,
			icon: item.icon,
			cost: item.cost,
			stock: item.stock,
			status: item.status,
			userCount: item.user_count,
			nextRefreshTime: item.next_refresh_time, // seconds until restock
			expireDay: item.expire_day
		}));

		// Keep category matching independent of the notification language.
		if (language !== "en-us") {
			const englishItems = await this.getShopItems(accountData, versionId, "en-us");
			if (!englishItems.success) {
				return englishItems;
			}
			for (const item of items) {
				item.policyName = englishItems.data.find(englishItem => englishItem.id === item.id)?.name;
				if (!item.policyName) {
					return { success: false, message: t("Failed to match Mimo shop items") };
				}
			}
		}

		return { success: true, data: items };
	}

	async getShopPurchases (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);
		const purchases = [];
		const pageSize = 100;

		// Stock depletion can mask the personal limit in exchange-list.
		for (let page = 1; ; page++) {
			const res = await this.#request("point-record", {
				params: {
					lang: "en-us",
					game_id: this.#gameId,
					version_id: versionId,
					operator_type: 2,
					page,
					page_size: pageSize
				},
				cookie: cookieData
			});

			if (res.statusCode !== 200 || res.body?.retcode !== 0 || !Array.isArray(res.body.data?.list)) {
				return { success: false, message: res.body?.message || t("Failed to fetch Mimo shop purchases") };
			}

			const records = res.body.data.list;
			for (const record of records) {
				if (record.point_type === 4) { // Shop exchange, rather than a lottery draw
					purchases.push({ name: record.desc, cost: Number(record.point) });
				}
			}

			if (records.length < pageSize || page * pageSize >= res.body.data.total_count) {
				break;
			}
		}

		return { success: true, data: purchases };
	}

	async exchangeItem (accountData, awardId, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("exchange", {
			method: "POST",
			data: {
				award_id: awardId,
				game_id: this.#gameId,
				lang: app.Config.get("language") || "en-us",
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: t("Failed to exchange Mimo item"),
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

	async getLotteryInfo (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("lottery-info", {
			params: {
				lang: app.Config.get("language") || "en-us",
				game_id: this.#gameId,
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			return {
				success: false,
				message: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode) || res.body.message || t("Failed to fetch Mimo lottery info")
			};
		}

		return {
			success: true,
			data: {
				currentPoints: res.body.data.point,
				cost: res.body.data.cost,
				currentCount: res.body.data.count,
				limitCount: res.body.data.limit_count,
				rewards: res.body.data.award_list
			}
		};
	}

	async drawLottery (accountData, versionId) {
		const cookieData = this.#getCookieData(accountData);

		const res = await this.#request("lottery", {
			method: "POST",
			data: {
				game_id: this.#gameId,
				lang: app.Config.get("language") || "en-us",
				version_id: versionId
			},
			cookie: cookieData
		});

		if (res.statusCode !== 200 || res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Mimo`, {
				message: t("Failed to draw lottery"),
				args: { body: res.body }
			});
			return { success: false, message: res.body?.message };
		}

		return {
			success: true,
			data: {
				name: res.body.data.name,
				type: res.body.data.type,
				code: res.body.data.exchange_code,
				rewardId: res.body.data.award_id
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

	#getPremiumCurrencyItems (shopItems = []) {
		const currencyName = this.#getPremiumCurrencyName();
		return shopItems
			.filter(item => (item.policyName || item.name || "").toLowerCase().includes(currencyName))
			.map(item => ({
				...item,
				cost: Number(item.cost) || 0
			}));
	}

	#getShopPolicyRules (accountData) {
		const configuredPolicy = accountData.mimo?.shopPolicy;
		const policyRules = Array.isArray(configuredPolicy) && configuredPolicy.length > 0
			? configuredPolicy
			: DefaultShopPolicy;

		const knownCategories = new Set(Object.values(MimoItemCategory));
		const knownModes = new Set(Object.values(MimoPolicyMode));
		const rules = [];
		const usedCategories = new Set();

		for (const rule of policyRules) {
			if (!knownCategories.has(rule?.category) || !knownModes.has(rule?.mode) || usedCategories.has(rule.category)) {
				continue;
			}

			rules.push({
				category: rule.category,
				mode: rule.mode
			});
			usedCategories.add(rule.category);
		}

		for (const rule of DefaultShopPolicy) {
			if (!usedCategories.has(rule.category)) {
				rules.push(rule);
			}
		}

		return rules;
	}

	#getItemCategory (item) {
		const name = (item?.policyName || item?.name || "").toLowerCase();
		if (name.includes(this.#getPremiumCurrencyName())) {
			return MimoItemCategory.PREMIUM_CURRENCY;
		}

		if (CosmeticKeywords.some(keyword => name.includes(keyword))) {
			return MimoItemCategory.HOYOLAB_COSMETICS;
		}

		return MimoItemCategory.GAME_MATERIALS;
	}

	#getPolicyRule (category, policyRules) {
		return policyRules.find(rule => rule.category === category)
			|| { category, mode: MimoPolicyMode.NEVER };
	}

	#buildInventorySignature (shopItems = []) {
		return shopItems
			.map(item => {
				const id = item.id ?? "";
				const cost = Number(item.cost) || 0;
				const name = (item.policyName || item.name || "").toLowerCase();
				return `${id}:${cost}:${name}`;
			})
			.sort((a, b) => a.localeCompare(b))
			.join("|");
	}

	#normalizeTimestamp (value) {
		if (value === null || typeof value === "undefined") {
			return null;
		}

		if (typeof value === "number" && Number.isFinite(value)) {
			return Math.trunc(value > 1e12 ? value : value * 1000);
		}

		if (typeof value === "string") {
			const trimmed = value.trim();
			if (trimmed.length === 0) {
				return null;
			}

			if (/^\d+$/.test(trimmed)) {
				const numeric = Number(trimmed);
				if (Number.isFinite(numeric)) {
					return Math.trunc(numeric > 1e12 ? numeric : numeric * 1000);
				}
			}

			const parsed = Date.parse(trimmed);
			if (!Number.isNaN(parsed)) {
				return parsed;
			}
		}

		return null;
	}

	#formatTimestampForLog (value) {
		if (value === null) {
			return "unknown";
		}

		return new Date(value).toISOString();
	}

	#getShopPlanCacheKey (accountData) {
		return `${this.#instance.name}:mimo:shop-policy:${this.#gameId}:${accountData.uid}`;
	}

	async #loadShopPlanSnapshot (accountData) {
		try {
			return await app.Cache.get(this.#getShopPlanCacheKey(accountData));
		}
		catch (e) {
			app.Logger.warn(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Failed to load Mimo shop policy snapshot: ${e.message}`);
			return null;
		}
	}

	async #saveShopPlanSnapshot (accountData, snapshot) {
		try {
			await app.Cache.set({
				key: this.#getShopPlanCacheKey(accountData),
				value: snapshot
			});
		}
		catch (e) {
			app.Logger.warn(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Failed to save Mimo shop policy snapshot: ${e.message}`);
		}
	}

	#isNewInventory (previousSnapshot, currentSnapshot) {
		if (!previousSnapshot) {
			return true;
		}

		return previousSnapshot.versionId !== currentSnapshot.versionId
			|| previousSnapshot.durationStart !== currentSnapshot.durationStart
			|| previousSnapshot.durationEnd !== currentSnapshot.durationEnd
			|| previousSnapshot.signature !== currentSnapshot.signature;
	}

	#isSnapshotCompatible (snapshot, meta) {
		if (!snapshot?.items || typeof snapshot.items !== "object") {
			return false;
		}

		return snapshot.formatVersion === ShopPlanFormatVersion
			&& snapshot.versionId === meta.versionId
			&& snapshot.durationStart === meta.durationStart
			&& snapshot.durationEnd === meta.durationEnd;
	}

	#getTrackedItem (snapshot, itemId) {
		if (!snapshot?.items || typeof snapshot.items !== "object") {
			return null;
		}

		return snapshot.items[itemId] ?? null;
	}

	#isItemExhausted (item, trackedItem, purchases) {
		const name = item.policyName || item.name;
		if (purchases.some(purchase => purchase.name === name && purchase.cost === Number(item.cost))) {
			return true;
		}

		if (item.status === MimoShopItemStatus.LIMIT_REACHED) {
			return true;
		}

		if (item.status === MimoShopItemStatus.EXCHANGEABLE) {
			return false;
		}

		return trackedItem?.exhausted === true
			&& trackedItem.policyName === name
			&& trackedItem.cost === Number(item.cost);
	}

	#getModeRank (mode) {
		switch (mode) {
			case MimoPolicyMode.ALWAYS:
				return 0;
			case MimoPolicyMode.CONDITIONAL:
				return 1;
			default:
				return 2;
		}
	}

	#buildShopPlanItems (shopItems, policyRules, snapshot, purchases = []) {
		const items = shopItems.map(item => {
			const category = this.#getItemCategory(item);
			const rule = this.#getPolicyRule(category, policyRules);
			const trackedItem = this.#getTrackedItem(snapshot, item.id);

			return {
				...item,
				cost: Number(item.cost) || 0,
				category,
				mode: rule.mode,
				priority: policyRules.findIndex(policyRule => policyRule.category === category),
				exhausted: this.#isItemExhausted(item, trackedItem, purchases)
			};
		});

		return items.sort((a, b) => {
			const modeRankDiff = this.#getModeRank(a.mode) - this.#getModeRank(b.mode);
			if (modeRankDiff !== 0) {
				return modeRankDiff;
			}

			if (a.priority !== b.priority) {
				return a.priority - b.priority;
			}

			return b.cost - a.cost;
		});
	}

	#getFutureLiability (item, durationEnd, now) {
		if (item.mode === MimoPolicyMode.NEVER || item.exhausted) {
			return 0;
		}

		if (item.status === MimoShopItemStatus.SOLD_OUT && !(item.nextRefreshTime > 0)) {
			return 0;
		}

		if ([MimoShopItemStatus.NOT_EXCHANGEABLE, MimoShopItemStatus.SOLD_OUT].includes(item.status) && item.nextRefreshTime > 0
			&& Number.isFinite(durationEnd) && now + item.nextRefreshTime * 1000 >= durationEnd) {
			return 0;
		}

		// Weekly restocks replenish global stock; every reward is once per version.
		return item.cost;
	}

	#getThresholds (items, options = {}) {
		const reservePoints = options.reservePoints ?? 0;
		const now = options.now ?? Date.now();

		let alwaysThreshold = 0;
		let conditionalThreshold = 0;

		for (const item of items) {
			const liability = this.#getFutureLiability(item, options.durationEnd, now);
			if (item.mode === MimoPolicyMode.ALWAYS) {
				alwaysThreshold += liability;
			}
			else if (item.mode === MimoPolicyMode.CONDITIONAL) {
				conditionalThreshold += liability;
			}
		}

		// The configured floor applies to lottery spending, after guaranteed rewards.
		const thresholdAlways = alwaysThreshold;
		const thresholdConditional = Math.max(alwaysThreshold + conditionalThreshold, reservePoints);

		return {
			rawAlways: alwaysThreshold,
			rawConditional: alwaysThreshold + conditionalThreshold,
			thresholdAlways,
			thresholdConditional
		};
	}

	#isItemExchangeable (item) {
		return item.status === MimoShopItemStatus.EXCHANGEABLE && !item.exhausted;
	}

	#buildShopPlanSnapshot (currentSnapshot, items, now) {
		const trackedItems = {};
		for (const item of items) {
			trackedItems[item.id] = {
				id: item.id,
				name: item.name,
				policyName: item.policyName || item.name,
				cost: item.cost,
				status: item.status,
				nextRefreshAt: item.nextRefreshTime > 0 ? now + item.nextRefreshTime * 1000 : null,
				exhausted: item.exhausted,
				updatedAt: now
			};
		}

		return {
			...currentSnapshot,
			formatVersion: ShopPlanFormatVersion,
			items: trackedItems,
			updatedAt: now
		};
	}

	#markItemPurchased (item) {
		item.status = MimoShopItemStatus.LIMIT_REACHED;
		item.exhausted = true;
	}

	async run (accountData) {
		const runKey = `${this.#gameId}:${accountData.uid}`;
		if (RunningAccounts.has(runKey)) {
			return { success: false, alreadyRunning: true, message: t("Mimo automation is already running for this account") };
		}

		RunningAccounts.add(runKey);
		try {
			return await this.#run(accountData);
		}
		finally {
			RunningAccounts.delete(runKey);
		}
	}

	async #run (accountData) {
		const results = {
			tasksFinished: [],
			tasksClaimed: [],
			itemsExchanged: [],
			codesRedeemed: [],
			codesObtained: [],
			lotteryDraws: [],
			errors: [],
			points: 0,
			shopStatus: []
		};

		const gameInfo = await this.getGameInfo(accountData);
		if (!gameInfo.success) {
			return { success: false, message: gameInfo.message || t("Failed to get Mimo game info") };
		}

		const { versionId } = gameInfo.data;
		const durationStart = this.#normalizeTimestamp(gameInfo.data.startTime);
		const durationEnd = this.#normalizeTimestamp(gameInfo.data.endTime);
		if (Number.isFinite(durationEnd) && durationEnd <= Date.now()) {
			return { success: false, message: t("Mimo event has ended") };
		}
		results.points = gameInfo.data.points;

		app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Starting Mimo automation - Current points: ${results.points}`);

		const tasks = await this.getTasks(accountData, versionId);
		if (tasks.success) {
			for (const task of tasks.data) {
				if (task.status === MimoTaskStatus.ONGOING && FinishableTaskTypes.includes(task.taskType)) {
					const finishResult = await this.finishTask(accountData, task.id, versionId);
					if (finishResult.success) {
						results.tasksFinished.push(task.name);
						task.status = MimoTaskStatus.FINISHED;
						app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Finished task: ${task.name}`);
					}
					await sleep(1000);
				}
				if (task.status === MimoTaskStatus.FINISHED) {
					const claimResult = await this.claimTaskReward(accountData, task.id, versionId);
					if (claimResult.success) {
						results.tasksClaimed.push({ name: task.name, points: task.point });
						results.points += task.point;
						app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Claimed ${task.point} points for: ${task.name}`);
					}
					await sleep(1000);
				}
			}
		}

		const updatedGameInfo = await this.getGameInfo(accountData);
		if (updatedGameInfo.success) {
			results.points = updatedGameInfo.data.points;
		}

		const shopPolicyEnabled = Array.isArray(accountData.mimo?.shopPolicy) && accountData.mimo.shopPolicy.length > 0;
		const policyRules = this.#getShopPolicyRules(accountData);
		const staticReservePoints = Math.max(0, Number(accountData.mimo?.reservePoints) || 0);
		const now = Date.now();
		const budgetOptions = { reservePoints: staticReservePoints, durationEnd, now };
		const currentMeta = { versionId, durationStart, durationEnd };
		let thresholdAlways = 0;
		let thresholdConditional = staticReservePoints;
		let thresholdSource = "static";
		let shopPlanSnapshot = null;
		let canRunLottery = true;

		if (shopPolicyEnabled) {
			shopPlanSnapshot = await this.#loadShopPlanSnapshot(accountData);
			app.Logger.info(
				`${this.#instance.fullName}:Mimo`,
				t `(${accountData.uid}) Inventory duration detected: ${this.#formatTimestampForLog(durationStart)} -> ${this.#formatTimestampForLog(durationEnd)}`
			);
		}

		const shopItems = await this.getShopItems(accountData, versionId);
		if (shopItems.success) {
			const currentSnapshot = {
				...currentMeta,
				signature: this.#buildInventorySignature(shopItems.data)
			};
			let purchases = [];
			if (shopPolicyEnabled) {
				const purchaseHistory = await this.getShopPurchases(accountData, versionId).catch(() => ({ success: false }));
				if (purchaseHistory.success) {
					purchases = purchaseHistory.data;
				}
				else {
					app.Logger.warn(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Shop purchase history unavailable. Reserving points for unconfirmed rewards.`);
				}
			}

			const compatibleSnapshot = this.#isSnapshotCompatible(shopPlanSnapshot, currentMeta) ? shopPlanSnapshot : null;
			const plannedItems = shopPolicyEnabled
				? this.#buildShopPlanItems(shopItems.data, policyRules, compatibleSnapshot, purchases)
				: this.#getPremiumCurrencyItems(shopItems.data).sort((a, b) => b.cost - a.cost);

			results.shopStatus = shopItems.data.map(item => ({
				name: item.name,
				cost: item.cost,
				stock: item.stock,
				status: item.status,
				nextRefreshTime: item.nextRefreshTime
			}));

			if (shopPolicyEnabled) {
				const inventoryChanged = this.#isNewInventory(shopPlanSnapshot, currentSnapshot);
				const thresholds = this.#getThresholds(plannedItems, budgetOptions);
				thresholdAlways = thresholds.thresholdAlways;
				thresholdConditional = thresholds.thresholdConditional;
				thresholdSource = "live";

				if (inventoryChanged) {
					app.Logger.info(
						`${this.#instance.fullName}:Mimo`,
						t `(${accountData.uid}) New inventory detected. Rebuilt Mimo shop plan (always=${thresholdAlways}, guaranteed=${thresholds.rawConditional}, lotteryReserve=${thresholdConditional})`
					);
				}
				else {
					app.Logger.info(
						`${this.#instance.fullName}:Mimo`,
						t `(${accountData.uid}) Inventory unchanged. Mimo budget: always=${thresholdAlways}, guaranteed=${thresholds.rawConditional}, lotteryReserve=${thresholdConditional}`
					);
				}

				await this.#saveShopPlanSnapshot(
					accountData,
					this.#buildShopPlanSnapshot({
						...currentSnapshot,
						thresholdAlways,
						thresholdConditional
					}, plannedItems, now)
				);
			}

			for (const item of plannedItems) {
				if (item.mode === MimoPolicyMode.NEVER) {
					continue;
				}

				if (!this.#isItemExchangeable(item)) {
					continue;
				}

				if (results.points < item.cost) {
					continue;
				}

				if (shopPolicyEnabled && item.mode === MimoPolicyMode.CONDITIONAL) {
					const currentThresholds = this.#getThresholds(plannedItems, budgetOptions);
					if ((results.points - item.cost) < currentThresholds.thresholdAlways) {
						continue;
					}
				}

				const exchangeResult = await this.exchangeItem(accountData, item.id, versionId);
				if (exchangeResult.success) {
					const code = exchangeResult.data?.code;
					results.itemsExchanged.push({ name: item.name, cost: item.cost, code });
					results.points -= item.cost;
					this.#markItemPurchased(item);

					if (shopPolicyEnabled) {
						const thresholds = this.#getThresholds(plannedItems, budgetOptions);
						thresholdAlways = thresholds.thresholdAlways;
						thresholdConditional = thresholds.thresholdConditional;
						thresholdSource = "live";

						await this.#saveShopPlanSnapshot(
							accountData,
							this.#buildShopPlanSnapshot({
								...currentSnapshot,
								thresholdAlways,
								thresholdConditional
							}, plannedItems, now)
						);
					}

					if (!code) {
						app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Exchanged ${item.name}`);
						await sleep(1500);
						continue;
					}

					app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Exchanged ${item.name} for code: ${code}`);

					// Check if auto-redeem is enabled (mimo.redeem defaults to true for backward compatibility)
					const shouldRedeem = accountData.redeemCode && (accountData.mimo?.redeem !== false);

					if (shouldRedeem) {
						await sleep(5000);
						const redeemResult = await this.#instance.redeemCode(accountData, code);
						if (redeemResult.success) {
							results.codesRedeemed.push(code);
							app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Redeemed code: ${code}`);
						}
						else {
							results.errors.push(t `Failed to redeem code ${code}: ${redeemResult.message}`);
						}
					}
					else {
						// Code obtained but not auto-redeemed
						results.codesObtained.push(code);
						app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Code obtained (not auto-redeemed): ${code}`);
					}
				}

				await sleep(1500);
			}

			if (shopPolicyEnabled) {
				const thresholds = this.#getThresholds(plannedItems, budgetOptions);
				thresholdAlways = thresholds.thresholdAlways;
				thresholdConditional = thresholds.thresholdConditional;
				thresholdSource = "live";
			}
		}
		else if (shopPolicyEnabled) {
			if (this.#isSnapshotCompatible(shopPlanSnapshot, currentMeta)) {
				const cachedItems = Object.values(shopPlanSnapshot.items).map(item => ({
					...item,
					nextRefreshTime: item.nextRefreshAt ? Math.max(0, (item.nextRefreshAt - now) / 1000) : 0
				}));
				const plannedItems = this.#buildShopPlanItems(cachedItems, policyRules, shopPlanSnapshot);
				const thresholds = this.#getThresholds(plannedItems, budgetOptions);
				thresholdAlways = thresholds.thresholdAlways;
				thresholdConditional = thresholds.thresholdConditional;
				thresholdSource = "cache";

				app.Logger.info(
					`${this.#instance.fullName}:Mimo`,
					t `(${accountData.uid}) Shop data unavailable. Using cached Mimo thresholds: threshold1=${thresholdAlways}, threshold2=${thresholdConditional}`
				);
			}
			else {
				canRunLottery = false;
				thresholdSource = "unavailable";

				app.Logger.warn(
					`${this.#instance.fullName}:Mimo`,
					t `(${accountData.uid}) Shop data unavailable and no compatible cached snapshot found. Lottery paused to protect guaranteed rewards.`
				);
			}
		}

		if (shopPolicyEnabled) {
			const pointsAvailableForConditional = Math.max(0, results.points - thresholdAlways);
			const pointsAvailableForLottery = canRunLottery ? Math.max(0, results.points - thresholdConditional) : 0;

			app.Logger.info(
				`${this.#instance.fullName}:Mimo`,
				t `(${accountData.uid}) Budget breakdown (source=${thresholdSource}): staticFloor=${staticReservePoints}, alwaysReserve=${thresholdAlways}, lotteryReserve=${thresholdConditional}, pointsAvailableForConditional=${pointsAvailableForConditional}, pointsAvailableForLottery=${pointsAvailableForLottery}`
			);
		}

		const lotteryEnabled = accountData.mimo?.lottery === true;

		if (lotteryEnabled && canRunLottery) {
			const lotteryInfo = await this.getLotteryInfo(accountData, versionId);
			if (lotteryInfo.success) {
				const { cost, currentCount, limitCount, currentPoints } = lotteryInfo.data;
				let drawsRemaining = Math.max(0, limitCount - currentCount);
				if (Number.isFinite(Number(currentPoints))) {
					results.points = Number(currentPoints);
				}

				if (Number.isFinite(durationEnd)) {
					const dayMs = 24 * 60 * 60 * 1000;
					const resetOffsetMs = 8 * 60 * 60 * 1000; // Daily draw limit resets at midnight UTC+8.
					const daysRemaining = Math.max(0, Math.floor((durationEnd + resetOffsetMs) / dayMs) - Math.floor((Date.now() + resetOffsetMs) / dayMs));
					const drawCapacity = drawsRemaining + daysRemaining * limitCount;
					const surplus = Math.max(0, results.points - thresholdConditional);
					app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Lottery budget: surplus=${surplus}, drawsRemainingToday=${drawsRemaining}, drawsBeforeSeasonEnd=${drawCapacity}`);
					if (surplus > drawCapacity * cost) {
						app.Logger.warn(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Daily lottery limit cannot spend the current surplus before season end: at least ${surplus - drawCapacity * cost} points remain even without point rebates or future earnings.`);
					}
				}

				// Spend safe surplus at every opportunity; delaying draws loses daily capacity.
				while (drawsRemaining > 0 && cost > 0 && (results.points - thresholdConditional) >= cost) {
					const drawResult = await this.drawLottery(accountData, versionId);
					if (!drawResult.success) {
						break;
					}

					results.lotteryDraws.push({
						name: drawResult.data.name,
						code: drawResult.data.code
					});
					results.points -= cost;
					const reward = lotteryInfo.data.rewards?.find(item => item.award_id === drawResult.data.rewardId);
					const pointsReward = drawResult.data.type === 3 || reward?.type === 3
						? drawResult.data.name?.match(/[×x]\s*(\d+)$/i)
						: drawResult.data.name?.match(/^Points\s*[×x]\s*(\d+)$/i);
					if (pointsReward) {
						results.points += Number(pointsReward[1]);
					}
					drawsRemaining--;

					app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Lottery draw: ${drawResult.data.name}`);

					if (drawResult.data.code) {
						const shouldRedeemDraw = accountData.redeemCode && (accountData.mimo?.redeemDraw !== false);
						if (shouldRedeemDraw) {
							await sleep(5000);
							const redeemResult = await this.#instance.redeemCode(accountData, drawResult.data.code);
							if (redeemResult.success) {
								results.codesRedeemed.push(drawResult.data.code);
								app.Logger.info(`${this.#instance.fullName}:Mimo`, t `(${accountData.uid}) Redeemed lottery code: ${drawResult.data.code}`);
							}
							else {
								results.errors.push(t `Failed to redeem lottery code ${drawResult.data.code}: ${redeemResult.message}`);
							}
						}
						else {
							results.codesObtained.push(drawResult.data.code);
						}
					}

					await sleep(1500);
					const updatedLotteryInfo = await this.getLotteryInfo(accountData, versionId).catch(() => ({ success: false }));
					if (updatedLotteryInfo.success) {
						if (Number.isFinite(Number(updatedLotteryInfo.data.currentPoints))) {
							results.points = Number(updatedLotteryInfo.data.currentPoints);
						}
						drawsRemaining = Math.min(drawsRemaining, Math.max(0, updatedLotteryInfo.data.limitCount - updatedLotteryInfo.data.currentCount));
					}
				}
			}
		}

		if (results.itemsExchanged.length > 0 || results.lotteryDraws.length > 0) {
			const finalGameInfo = await this.getGameInfo(accountData).catch(() => ({ success: false }));
			if (finalGameInfo.success && finalGameInfo.data.versionId === versionId) {
				results.points = finalGameInfo.data.points;
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
			return { success: false, message: gameInfo.message || t("Failed to get Mimo game info") };
		}

		const shopItems = await this.getShopItems(accountData, gameInfo.data.versionId);
		if (!shopItems.success) {
			return { success: false, message: shopItems.message || t("Failed to fetch Mimo shop items") };
		}

		const currencyName = this.#getPremiumCurrencyName();
		const currencyItem = this.#getPremiumCurrencyItems(shopItems.data).find(item => item.nextRefreshTime > 0)
			|| this.#getPremiumCurrencyItems(shopItems.data)[0];
		if (!currencyItem) {
			return { success: false, message: t `No ${currencyName} items found` };
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
