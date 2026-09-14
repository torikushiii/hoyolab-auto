const crypto = require("node:crypto");

const DataCache = require("./cache.js");
const CustomHoyoError = require("./error-messages.js");

const APP_LOGIN_SALT = "IZPgfb0dRPtBeLuFkdDznSZ6f4wWt6y2";
const REFRESH_API = "https://sg-public-api.hoyoverse.com/account/ma-passport/token/getBySToken";

const parseCookie = (cookie, separator = ";") => {
	const result = {};
	for (const rawPair of cookie.split(separator)) {
		const pair = rawPair.trim();
		const index = pair.indexOf("=");
		if (index > 0) {
			result[pair.slice(0, index)] = pair.slice(index + 1);
		}
	}
	return result;
};

const stringifyCookie = (cookie, separator = ";") => Object.entries(cookie)
	.map(([key, value]) => `${key}=${value}`)
	.join(`${separator} `);

const generateDynamicSecret = () => {
	const timestamp = Math.floor(Date.now() / 1000);
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const random = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
	const hash = crypto.createHash("md5")
		.update(`salt=${APP_LOGIN_SALT}&t=${timestamp}&r=${random}`)
		.digest("hex");
	return `${timestamp},${random},${hash}`;
};

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
	static webAPI = REFRESH_API;

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

		if (accounts.length === 0) {
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

			if (account.cookie.length === 0) {
				// this will just skip the account if there is no cookie provided
				continue;
			}

			if (this.#name === "honkai" || this.#name === "tot") {
				const parsedCookie = this.#parseCookie(account.cookie);
				this.#data.push({
					cookie: parsedCookie.cookie,
					ltuid: parsedCookie.ltuid,
					refreshCookie: parsedCookie.refreshCookie,
					allowedPlatforms: account.allowedPlatforms ?? null
				});
				break;
			}

			const { redeemCode, shopStatus, dailiesCheck, weekliesCheck, dailyLotteryCheck } = account;
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
			if (dailyLotteryCheck && typeof dailyLotteryCheck !== "boolean") {
				throw new app.Error({
					message: "Invalid check provided for HoyoLab expected boolean.",
					args: {
						dailyLotteryCheck,
						type: typeof dailyLotteryCheck
					}
				});
			}

			const { realm } = account;
			if (realm && typeof realm.check !== "boolean") {
				throw new app.Error({
					message: "Invalid realm.check provided for HoyoLab expected boolean.",
					args: {
						realm,
						type: typeof realm.check
					}
				});
			}
			if (realm && typeof realm.persistent !== "boolean") {
				throw new app.Error({
					message: "Invalid realm.persistent provided for HoyoLab expected boolean.",
					args: {
						realm,
						type: typeof realm.persistent
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

			this.#data.push({
				cookie: parsedCookie.cookie,
				ltuid: parsedCookie.ltuid,
				refreshCookie: parsedCookie.refreshCookie,
				redeemCode: parsedCookie.codeRedeem !== false ? redeemCode : parsedCookie.codeRedeem,
				redeemCodeConfigured: redeemCode,
				shopStatus,
				realm,
				dailiesCheck,
				dailyLotteryCheck,
				weekliesCheck,
				stamina,
				expedition,
				mimo: account.mimo,
				hilichurl: account.hilichurl,
				discord: account.discord ?? null,
				allowedPlatforms: account.allowedPlatforms ?? null
			});
		}

		this.#gameId = defaults.gameId;
		this.#config = defaults.config ?? {};

		if (this.#config.regenRate) {
			this.#dataCache = new DataCache(this.#config.regenRate);
		}

		HoyoLab.list.push(this);
	}

	get id () { return this.#id; }
	get name () { return this.#name; }
	get data () { return this.#data; }
	get gameId () { return this.#gameId; }
	get config () { return this.#config; }
	get type () { return this.#name; }
	get dataCache () { return this.#dataCache; }
	get webAPI () { return HoyoLab.webAPI; }

	get fullName () {
		const nameMap = {
			honkai: "HonkaiImpact",
			genshin: "GenshinImpact",
			starrail: "StarRail",
			nap: "ZenlessZoneZero",
			tot: "TearsOfThemis"
		};

		return nameMap[this.name] || this.name;
	}

	destroy () {}

	#parseCookie (cookie) {
		const cookieMap = parseCookie(cookie);

		const {
			stoken,
			ltoken_v2,
			ltuid_v2,
			ltmid_v2,
			cookie_token_v2,
			account_mid_v2,
			account_id_v2
		} = cookieMap;

		if (!ltoken_v2 || !ltuid_v2 || !ltmid_v2) {
			throw new app.Error({
				message: "No ltoken_v2, ltuid_v2, or ltmid_v2 found in cookie."
			});
		}

		const refreshCookie = stoken
			? stringifyCookie({ stoken, mid: ltmid_v2 })
			: null;

		if (cookie_token_v2 && account_mid_v2 && account_id_v2) {
			return {
				cookie: this.#buildCookie(cookieMap, { token: true }),
				codeRedeem: true,
				ltuid: ltuid_v2,
				refreshCookie
			};
		}

		if (this.name !== "honkai") {
			app.Logger.warn("HoyoLab", `No cookie_token_v2 or account_mid_v2 found in cookie for ${this.name}. This will disable "redeemCode" functionality.`);
		}

		return {
			cookie: this.#buildCookie(cookieMap),
			codeRedeem: false,
			ltuid: ltuid_v2,
			refreshCookie
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

		return stringifyCookie(cookieObj);
	}

	static parseCookie (cookie, options = {}) {
		const { whitelist = [], blacklist = [], separator = ";" } = options;
		const cookieMap = parseCookie(cookie, separator);

		if (whitelist.length !== 0) {
			const filteredCookiesArray = Object.keys(cookieMap)
				.filter(key => whitelist.includes(key))
				.map(key => `${key}=${cookieMap[key]}`);

			return filteredCookiesArray.join(`${separator} `);
		}
		if (blacklist.length !== 0) {
			const filteredCookiesArray = Object.keys(cookieMap)
				.filter(key => !blacklist.includes(key))
				.map(key => `${key}=${cookieMap[key]}`);

			return filteredCookiesArray.join(`${separator} `);
		}

		return cookie;
	}

	static async refreshCookieAccounts (cookie = null) {
		const requestedLtuid = cookie ? parseCookie(cookie).ltuid_v2 : null;
		const accounts = new Map();
		for (const platform of HoyoLab.list) {
			for (const account of platform.data) {
				if (account.refreshCookie && (!requestedLtuid || account.ltuid === requestedLtuid)) {
					accounts.set(account.ltuid, { account, platform });
				}
			}
		}

		const results = [];
		const configuredAccounts = HoyoLab.list.flatMap(instance => instance.data);
		for (const { account, platform } of accounts.values()) {
			const notificationAccount = {
				ltuid: account.ltuid,
				discord: account.discord,
				allowedPlatforms: account.allowedPlatforms
			};
			const notificationAccounts = configuredAccounts
				.filter(item => item.ltuid === account.ltuid)
				.map(item => ({ discord: item.discord, allowedPlatforms: item.allowedPlatforms }));
			try {
				const result = await platform.updateCookie(account);
				if (!result.success) {
					app.Logger.warn("HoyoAuth", `Could not refresh the cookie for account ${account.ltuid}: ${result.reason}`);
					results.push({
						account: notificationAccount,
						accounts: notificationAccounts,
						success: false
					});
					continue;
				}

				for (const item of HoyoLab.list.flatMap(instance => [...instance.data, ...instance.accounts])) {
					const cookie = parseCookie(item.cookie);
					if (cookie.ltuid_v2 === account.ltuid) {
						item.cookie = stringifyCookie({
							...cookie,
							...result.data,
							account_id_v2: cookie.ltuid_v2,
							account_mid_v2: cookie.ltmid_v2
						});
						// Restore the user's preference now that redemption credentials are available.
						if (Object.hasOwn(item, "redeemCodeConfigured")) {
							item.redeemCode = item.redeemCodeConfigured;
						}
					}
				}
				results.push({
					account: notificationAccount,
					accounts: notificationAccounts,
					success: true
				});
			}
			catch (e) {
				app.Logger.error("HoyoAuth", `Could not refresh the cookie for account ${account.ltuid}: ${e.message}`);
				results.push({
					account: notificationAccount,
					accounts: notificationAccounts,
					success: false
				});
			}
		}

		return results;
	}

	static async refreshStoredCookies (cookie = null) {
		const results = await HoyoLab.refreshCookieAccounts(cookie);
		return results.some(result => result.success);
	}

	static isExpiredLogin (message) {
		return /(?:please\s+)?log\s*in|login/i.test(String(message ?? ""));
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

	static async redeemCode (game, uid, code) {
		// eslint-disable-next-line object-curly-spacing
		const accountData = HoyoLab.getActiveAccounts({ whitelist: game, uid });
		if (accountData.length === 0) {
			return {
				success: false,
				data: {
					reason: "No active accounts found for this type of game."
				}
			};
		}

		const disabled = accountData.every(account => account.redeemCode === false);
		if (disabled) {
			return {
				success: false,
				data: {
					reason: "Redeem code functionality is currently disabled for this account."
				}
			};
		}

		const platform = HoyoLab.get(game);
		const [account] = accountData;

		let res = await platform.redeemCode(account, code);
		if (!res.success && HoyoLab.isExpiredLogin(res.message) && await HoyoLab.refreshStoredCookies(account.cookie)) {
			res = await platform.redeemCode(account, code);
		}
		if (res.success) {
			return { success: true };
		}
		else {
			return {
				success: false,
				data: {
					code,
					reason: res.message
				}
			};
		}
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

		if (options.uid) {
			const account = accounts.find(account => account.uid === options.uid);
			return account ? [account] : [];
		}

		return accounts;
	}

	static getActivePlatform () {
		return HoyoLab.list.map(platform => platform.name);
	}

	static getAccountById (uid) {
		if (typeof uid !== "string") {
			throw new app.Error({
				message: "Invalid UID provided for getAccountById expected string.",
				args: {
					uid,
					type: typeof uid
				}
			});
		}

		const accounts = HoyoLab.list.flatMap(platform => platform.accounts);
		return accounts.find(account => account.uid === uid) ?? null;
	}

	static getRegion (region) {
		switch (region) {
			case "os_cht":
			case "prod_gf_sg":
			case "prod_official_cht":
				return "TW/HK/MO";
			case "os_asia":
			case "prod_gf_jp":
			case "prod_official_asia":
				return "SEA";
			case "eur01":
			case "os_euro":
			case "prod_gf_eu":
			case "prod_official_eur":
				return "EU";
			case "usa01":
			case "os_usa":
			case "prod_gf_us":
			case "prod_official_usa":
				return "NA";
			default:
				return "Unknown";
		}
	}

	static errorMessage (type, code) {
		if (!type || !code) {
			throw new app.Error({
				message: "Invalid type or code provided for HoyoError.",
				args: {
					type,
					code
				}
			});
		}

		return CustomHoyoError(type, code);
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
	async notes (accountData) {
		throw new app.Error({
			message: "This method is not implemented by the derived class."
		});
	}

	/**
	 * @abstract
	 */
	async checkIn () {
		throw new app.Error({
			message: "This method is not implemented by the derived class."
		});
	}

	async updateCookie (accountData) {
		if (!accountData.refreshCookie) {
			return { success: false, reason: "No stoken configured" };
		}

		const res = await app.Got("HoYoLab", {
			url: this.webAPI,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			json: {
				dst_token_types: [2, 4]
			},
			headers: {
				ds: generateDynamicSecret(),
				"x-rpc-app_id": "c9oqaq3s3gu8",
				Cookie: accountData.refreshCookie
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.fullName}:UpdateCookie`, {
				message: "Failed to update cookie",
				args: {
					platform: this.name,
					uid: accountData.ltuid,
					region: accountData.region,
					statusCode: res.statusCode
				}
			});

			return { success: false, reason: `HTTP ${res.statusCode}` };
		}

		if (res.body?.retcode !== 0 || !Array.isArray(res.body?.data?.tokens)) {
			app.Logger.log(`${this.fullName}:UpdateCookie`, {
				message: "Failed to update cookie",
				args: {
					platform: this.name,
					uid: accountData.ltuid,
					region: accountData.region,
					retcode: res.body?.retcode,
					reason: res.body?.message
				}
			});

			return { success: false, reason: res.body?.message ?? "Invalid response" };
		}

		const tokens = {};
		for (const token of res.body.data.tokens) {
			if (token.token_type === 2) {
				tokens.ltoken_v2 = token.token;
			}
			else if (token.token_type === 4) {
				tokens.cookie_token_v2 = token.token;
			}
		}

		if (!tokens.ltoken_v2 || !tokens.cookie_token_v2) {
			return { success: false, reason: "Missing tokens in response" };
		}

		return {
			success: true,
			data: tokens
		};
	}

	static create (type, config) {
		try {
			const InstancePlatform = require(`./${type}/index.js`);
			return new InstancePlatform(config);
		}
		catch (e) {
			console.log(`Failed to create platform ${type}.`);
			console.error(e);
		}
	}
};
