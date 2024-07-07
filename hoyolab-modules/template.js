class DataCache {
	static data = new Map();
	static expirationInterval;

	constructor (expiration = 3_650_000, rate) {
		this.expiration = expiration;
		this.rate = rate;

		if (!DataCache.expirationInterval) {
			DataCache.expirationInterval = setInterval(() => DataCache.data.clear(), this.expiration);
		}
	}

	async set (key, value, lastUpdate = Date.now()) {
		const data = { ...value, lastUpdate };
		DataCache.data.set(key, data);

		if (app.Cache) {
			await app.Cache.set({ key, value: data });
		}
	}

	async get (key) {
		// 1. Attempt to get data from memory cache
		let cachedData = DataCache.data.get(key);
		if (cachedData) {
			return this.#updateCachedData(cachedData);
		}

		// 2. Attempt to get data from keyv cache
		if (app.Cache) {
			cachedData = await app.Cache.get(key);
			if (cachedData) {
				DataCache.data.set(key, cachedData);
				return this.#updateCachedData(cachedData);
			}
		}

		return null;
	}

	async #updateCachedData (cachedData) {
		const now = Date.now();

		if (now - cachedData.lastUpdate > this.expiration) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		const secondsSinceLastUpdate = (now - cachedData.lastUpdate) / 1000;
		const recoveredStamina = Math.floor(secondsSinceLastUpdate / this.rate);

		const account = app.HoyoLab.getAccountById(cachedData.uid);

		const isMaxStamina = cachedData.stamina.currentStamina === cachedData.stamina.maxStamina;
		const isAboveThreshold = cachedData.stamina.currentStamina > account.stamina.threshold;

		if (isMaxStamina || isAboveThreshold) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		cachedData.stamina.currentStamina = Math.min(
			cachedData.stamina.maxStamina,
			cachedData.stamina.currentStamina + recoveredStamina
		);
		cachedData.stamina.recoveryTime -= Math.round(secondsSinceLastUpdate);

		if (cachedData.stamina.recoveryTime <= 0) {
			await DataCache.invalidateCache(cachedData.uid);
			return null;
		}

		const expedition = cachedData.expedition;
		if (expedition && expedition.list.length !== 0) {
			for (const expedition of cachedData.expedition.list) {
				expedition.remaining_time = Number(expedition.remaining_time);
				if (expedition.remaining_time <= 0) {
					await DataCache.invalidateCache(cachedData.uid);
					return null;
				}
				else {
					expedition.remaining_time -= Math.round(secondsSinceLastUpdate);
				}
			}
		}

		if (cachedData.shop) {
			const shop = cachedData.shop;
			if (shop.state === "Finished") {
				await DataCache.invalidateCache(cachedData.uid);
				return null;
			}
		}

		return cachedData;
	}

	static async invalidateCache (key) {
		DataCache.data.delete(key);

		if (app.Cache) {
			await app.Cache.delete(key);
		}
	}

	static destroy () {
		clearInterval(DataCache.expirationInterval);
		DataCache.data.clear();
	}
}

module.exports = class HoyoLab {
	#id;
	#name;
	#data = [];
	#gameId;
	#config;
	#dataCache;

	accounts = [];

	/** @type {HoyoLab[]} */
	static list = [];

	constructor (name, config, defaults = {}) {
		this.#name = name;
		this.#id = config.id;
		if (!this.#id) {
			throw new app.Error({
				message: "No ID provided for HoyoLab."
			});
		}
		else if (typeof this.#id !== "number") {
			throw new app.Error({
				message: "Invalid ID must be a number."
			});
		}

		const accounts = config.data;
		if (!Array.isArray(accounts)) {
			throw new app.Error({
				message: "Invalid data provided for HoyoLab must be an array.",
				args: {
					data: accounts,
					type: typeof accounts
				}
			});
		}

		if (accounts === 0) {
			throw new app.Error({
				message: `No accounts provided for ${name}, please provide at least one account or disable the platform.`
			});
		}

		for (const account of accounts) {
			if (typeof account.cookie === "object") {
				throw new app.Error({
					message: "This cookie method is deprecated, please follow the new cookie guide again: https://gist.github.com/torikushiii/59eff33fc8ea89dbc0b2e7652db9d3fd"
				});
			}

			if (this.#name === "honkai") {
				const parsedCookie = this.#parseCookie(account.cookie);
				const ltuid = account.cookie.match(/ltuid_v2=([^;]+)/)[1];
				this.#data.push({
					cookie: parsedCookie.cookie,
					ltuid
				});
				break;
			}

			const { redeemCode, shopStatus, dailiesCheck, weekliesCheck } = account;
			if (dailiesCheck && typeof dailiesCheck !== "boolean") {
				throw new app.Error({
					message: "Invalid check provided for HoyoLab expected boolean.",
					args: {
						dailiesCheck,
						type: typeof dailiesCheck
					}
				});
			}
			if (weekliesCheck && typeof weekliesCheck !== "boolean") {
				throw new app.Error({
					message: "Invalid check provided for HoyoLab expected boolean.",
					args: {
						weekliesCheck,
						type: typeof weekliesCheck
					}
				});
			}
			if (redeemCode && typeof redeemCode !== "boolean") {
				throw new app.Error({
					message: "Invalid check provided for HoyoLab expected boolean.",
					args: {
						redeemCode,
						type: typeof redeemCode
					}
				});
			}
			if (shopStatus && typeof shopStatus !== "boolean") {
				throw new app.Error({
					message: "Invalid check provided for HoyoLab expected boolean.",
					args: {
						shopStatus,
						type: typeof shopStatus
					}
				});
			}

			const { stamina } = account;
			if (!stamina || typeof stamina.check !== "boolean" || typeof stamina.threshold !== "number" || typeof stamina.persistent !== "boolean") {
				throw new app.Error({
					message: "Invalid stamina object provided for HoyoLab.",
					args: {
						stamina
					}
				});
			}

			const maxStamina = defaults.config.maxStamina;
			if (stamina.threshold > maxStamina) {
				throw new app.Error({
					message: `Invalid stamina threshold provided for ${name}. Maximum stamina is ${maxStamina}.`,
					args: {
						threshold: stamina.threshold
					}
				});
			}

			const { expedition } = account;
			if (expedition && typeof expedition.check !== "boolean") {
				throw new app.Error({
					message: "Invalid expedition.check provided for HoyoLab expected boolean.",
					args: {
						expedition
					}
				});
			}
			if (expedition && typeof expedition.persistent !== "boolean") {
				throw new app.Error({
					message: "Invalid expedition.persistent provided for HoyoLab expected boolean.",
					args: {
						expedition
					}
				});
			}

			const parsedCookie = this.#parseCookie(account.cookie);
			const ltuid = account.cookie.match(/ltuid_v2=([^;]+)/)[1];
			this.#data.push({
				cookie: parsedCookie.cookie,
				ltuid,
				redeemCode: parsedCookie.codeRedeem !== false ? redeemCode : parsedCookie.codeRedeem,
				shopStatus,
				dailiesCheck,
				weekliesCheck,
				stamina,
				expedition
			});
		}

		this.#gameId = defaults.gameId;
		this.#config = defaults.config ?? {};
		this.#dataCache = new DataCache(3_650_000, this.#config.regenRate);

		HoyoLab.list.push(this);
	}

	get id () { return this.#id; }
	get name () { return this.#name; }
	get data () { return this.#data; }
	get gameId () { return this.#gameId; }
	get config () { return this.#config; }
	get type () { return this.#name; }
	get dataCache () { return this.#dataCache; }

	get fullName () {
		const nameMap = {
			honkai: "HonkaiImpact",
			genshin: "GenshinImpact",
			starrail: "StarRail",
			nap: "ZenlessZoneZero"
		};

		return nameMap[this.name] || this.name;
	}

	destroy () {}

	#parseCookie (cookie) {
		const cookies = cookie.split("; ");
		const cookieMap = Object.fromEntries(
			cookies.map(c => {
				const [key, value] = c.split("=");
				return [key, value];
			})
		);

		const {
			ltoken_v2,
			ltuid_v2,
			ltmid_v2,
			cookie_token_v2,
			account_mid_v2,
			account_id_v2
		} = cookieMap;

		if (!ltoken_v2 || !ltuid_v2 || !ltmid_v2) {
			throw new app.Error({
				message: "No ltoken_v2, ltuid_v2, or ltmid_v2 found in cookie.",
				args: { cookie }
			});
		}

		if (cookie_token_v2 && account_mid_v2 && account_id_v2) {
			return {
				cookie: this.#buildCookie(cookieMap, { token: true }),
				codeRedeem: true
			};
		}

		if (this.name !== "honkai") {
			app.Logger.warn("HoyoLab", `No cookie_token_v2 or account_mid_v2 found in cookie for ${this.name}. This will disable "redeemCode" functionality.`);
		}

		return {
			cookie: this.#buildCookie(cookieMap),
			codeRedeem: false
		};
	}

	#buildCookie (cookie, options = {}) {
		const { token } = options;

		const cookieObj = {
			ltoken_v2: cookie.ltoken_v2,
			ltuid_v2: cookie.ltuid_v2,
			ltmid_v2: cookie.ltmid_v2
		};

		if (token) {
			cookieObj.cookie_token_v2 = cookie.cookie_token_v2;
			cookieObj.account_mid_v2 = cookie.account_mid_v2;
			cookieObj.account_id_v2 = cookie.account_id_v2;
		}

		return Object.entries(cookieObj)
			.map(([key, value]) => `${key}=${value}`)
			.join("; ");
	}

	static parseCookie (cookie, options = {}) {
		const { whitelist = [], separator = ";" } = options;

		const cookiesArray = cookie.split(separator).map(c => c.trim());
		const cookieMap = Object.fromEntries(
			cookiesArray.map(c => {
				const [key, value] = c.split("=");
				return [key, value];
			})
		);

		if (whitelist.length === 0) {
			return cookieMap.join(`${separator} `);
		}

		const filteredCookiesArray = Object.keys(cookieMap)
			.filter(key => whitelist.includes(key))
			.map(key => `${key}=${cookieMap[key]}`);

		return filteredCookiesArray.join(`${separator} `);
	}

	update (account) {
		const index = this.accounts.findIndex(i => i.uid === account.uid);
		if (index === -1) {
			throw new app.Error({
				message: "Account not found in platform.",
				args: {
					uid: account.uid
				}
			});
		}

		this.accounts[index] = account;
	}

	static supportedGames (options = {}) {
		let { whitelist, blacklist } = options;
		if (whitelist && blacklist) {
			throw new app.Error({
				message: "Cannot have both a whitelist and blacklist."
			});
		}

		if (whitelist && !Array.isArray(whitelist)) {
			whitelist = [whitelist];
		}
		if (blacklist && !Array.isArray(blacklist)) {
			blacklist = [blacklist];
		}

		const platforms = HoyoLab.list.flatMap(i => {
			if (whitelist && !whitelist.includes(i.name)) {
				return null;
			}
			else if (blacklist && blacklist.includes(i.name)) {
				return null;
			}

			return i.name;
		}).filter(i => i !== null);

		return platforms;
	}

	static async redeemCode (game, codes) {
		// eslint-disable-next-line object-curly-spacing
		const accountData = HoyoLab.getActiveAccounts({ whitelist: game });
		if (accountData.length === 0) {
			return {
				success: false,
				reply: "No active accounts found for this type of game."
			};
		}

		const allDisabled = accountData.every(account => account.redeemCode === false);
		if (allDisabled) {
			return {
				success: false,
				reply: "None of the accounts have redeemCode enabled. Please enable on accounts you wish to redeem codes on."
			};
		}

		if (!Array.isArray(codes)) {
			throw new app.Error({
				message: "Invalid codes provided for redeemCode expected array.",
				args: {
					codes,
					type: typeof codes
				}
			});
		}

		const success = [];
		const failed = [];

		const platform = HoyoLab.get(game);
		for (const account of accountData) {
			if (account.redeemCode === false) {
				continue;
			}

			for (const code of codes) {
				const res = await platform.redeemCode(account, code);
				if (res.success) {
					success.push({ uid: account.uid });
				}
				else {
					failed.push({
						uid: account.uid,
						reason: res.message
					});
				}
			}
		}

		return {
			success,
			failed
		};
	}

	static getActiveAccounts (options = {}) {
		let { whitelist, blacklist } = options;

		if (whitelist && blacklist) {
			throw new app.Error({
				message: "Cannot have both a whitelist and blacklist."
			});
		}

		if (whitelist && !Array.isArray(whitelist)) {
			if (whitelist === "zenless") {
				whitelist = "nap";
			}
			whitelist = [whitelist];
		}
		if (blacklist && !Array.isArray(blacklist)) {
			if (blacklist === "zenless") {
				blacklist = "nap";
			}
			blacklist = [blacklist];
		}

		const accounts = HoyoLab.list.flatMap(i => {
			if (whitelist && !whitelist.includes(i.name)) {
				return null;
			}
			else if (blacklist && blacklist.includes(i.name)) {
				return null;
			}

			return i.accounts;
		}).filter(i => i !== null);

		return accounts;
	}

	static getActivePlatform () {
		return HoyoLab.list.map(platform => platform.name);
	}

	static getAccountById (uid) {
		if (typeof uid !== "string") {
			throw new app.Error({
				message: "Invalid UID provided for getAccountById expected number.",
				args: {
					uid,
					type: typeof uid
				}
			});
		}

		const accounts = HoyoLab.list.flatMap(platform => platform.accounts);
		return accounts.find(account => account.uid === uid) ?? null;
	}

	static get (identifier) {
		if (identifier instanceof HoyoLab) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			return HoyoLab.list.find(i => i.id === identifier) ?? null;
		}
		else if (typeof identifier === "string") {
			const platform = HoyoLab.list.find(i => i.name === identifier);
			if (platform.length === 0) {
				return null;
			}

			return platform;
		}
		else {
			throw new app.Error({
				message: "Unrecognized identifier type.",
				args: typeof identifier
			});
		}
	}

	/**
	 * @abstract
	 */
	// eslint-disable-next-line no-unused-vars
	static async notes (accountData) {
		throw new app.Error({
			message: "This method is not implemented by the derived class."
		});
	}

	static create (type, config) {
		try {
			const InstancePlatform = require(`./${type}.js`);
			return new InstancePlatform(config);
		}
		catch (e) {
			console.log(`Failed to create platform ${type}.`);
			console.error(e);
		}
	}
};
