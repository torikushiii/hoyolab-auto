const GENSHIN_MAX_STAMINA = 200;
const STARRAIL_MAX_STAMINA = 240;

const RequestError = [
	{ retcode: -100, message: "The provided cookie is either invalid or expired." },
	{ retcode: -10001, message: "The provided cookie is either invalid or expired." },
	{ retcode: -10101, message: "Cannot get data after more than 30 accounts per cookie per day." },
	{ retcode: -1071, message: "The provided cookie is either invalid or expired." },
	{ retcode: -1048, message: "API system is busy, please try again later." },
	{ retcode: 1009, message: "The account does not exist" },
	{ retcode: -2017, message: "The code has been used" },
	{ retcode: -2001, message: "The code has expired" },
	{ retcode: -2003, message: "The code is invalid" },
	{ retcode: -2016, message: "Redemption is in cooldown" }
];

/**
 * This error indicates that a Geetest was triggered drung the request.
 */
const CatpchaCodes = [
	10035,
	5003,
	10041,
	1034
];

module.exports = class HoyoLab {
	#id;
	#name;
	#data;
	#gameId;
	#config;

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

		this.#data = config.data;
		if (!Array.isArray(this.#data)) {
			throw new app.Error({
				message: "Invalid data provided for HoyoLab must be an array.",
				args: {
					data: this.#data,
					type: typeof this.#data
				}
			});
		}

		if (this.#data.length === 0) {
			throw new app.Error({
				message: `No accounts provided for ${name}, please provide at least one account or disable the platform.`
			});
		}

		for (const account of this.#data) {
			const { token, mid, ltuid } = account.cookie;
			if (!token || !mid || !ltuid) {
				throw new app.Error({
					message: "Invalid cookie provided for HoyoLab.",
					args: {
						cookie: account.cookie
					}
				});
			}

			if (this.#name === "honkai") {
				break;
			}

			const { redeemCode, dailiesCheck, weekliesCheck } = account;
			if (typeof dailiesCheck !== "boolean" || typeof weekliesCheck !== "boolean" || typeof redeemCode !== "boolean") {
				throw new app.Error({
					message: "Invalid check provided for HoyoLab expected boolean.",
					args: {
						dailiesCheck,
						weekliesCheck
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
            
			if (this.#name === "genshin" && stamina.threshold > GENSHIN_MAX_STAMINA) {
				throw new app.Error({
					message: `Invalid stamina threshold provided for Genshin. Maximum stamina is ${GENSHIN_MAX_STAMINA}.`,
					args: {
						threshold: stamina.threshold
					}
				});
			}
			else if (this.#name === "starrail" && stamina.threshold > STARRAIL_MAX_STAMINA) {
				throw new app.Error({
					message: `Invalid stamina threshold provided for Star Rail. Maximum stamina is ${STARRAIL_MAX_STAMINA}.`,
					args: {
						threshold: stamina.threshold
					}
				});
			}

			const { expedition } = account;
			if (!expedition || typeof expedition.check !== "boolean" || typeof expedition.persistent !== "boolean") {
				throw new app.Error({
					message: "Invalid expedition object provided for HoyoLab.",
					args: {
						expedition
					}
				});
			}
		}

		this.#gameId = defaults.gameId;
		this.#config = defaults.config ?? {};

		HoyoLab.list.push(this);
	}

	get id () { return this.#id; }
	get name () { return this.#name; }
	get data () { return this.#data; }
	get gameId () { return this.#gameId; }
	get config () { return this.#config; }
	get type () { return this.#name; }
	get RequestError () { return RequestError; }
	get CatpchaCodes () { return CatpchaCodes; }

	get fullName () {
		const nameMap = {
			honkai: "HonkaiImpact",
			genshin: "GenshinImpact",
			starrail: "StarRail"
		};

		return nameMap[this.name] || this.name;
	}

	destroy () {}

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
		const { whitelist, blacklist } = options;
		if (whitelist && blacklist) {
			throw new app.Error({
				message: "Cannot have both a whitelist and blacklist."
			});
		}

		if (whitelist) {
			return HoyoLab.list.flatMap(platform => {
				if (whitelist && !whitelist.includes(platform.name)) {
					return null;
				}

				return platform.name;
			}).filter(game => game !== null);
		}
		if (blacklist) {
			return HoyoLab.list.flatMap(platform => {
				if (blacklist && blacklist.includes(platform.name)) {
					return null;
				}

				return platform.name;
			}).filter(game => game !== null);
		}

		return HoyoLab.list.map(platform => platform.name);
	}

	static async redeemCode (game, codes) {
		const accountData = HoyoLab.getActiveAccounts({ whitelist: game });
		if (accountData.length === 0) {
			return {
				success: false,
				reply: "No active accounts found for this type of game."
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
		const { whitelist, blacklist } = options;
		if (whitelist && blacklist) {
			throw new app.Error({
				message: "Cannot have both a whitelist and blacklist."
			});
		}

		if (!Array.isArray(options.whitelist)) {
			const accounts = HoyoLab.list.flatMap(platform => platform.accounts);
			return accounts;
		}
		if (!Array.isArray(options.blacklist)) {
			const accounts = HoyoLab.list.flatMap(platform => platform.accounts);
			return accounts;
		}

		if (whitelist) {
			const accounts = HoyoLab.list.flatMap(platform => {
				if (whitelist && !whitelist.includes(platform.name)) {
					return null;
				}
	
				return platform.accounts;
			}).filter(account => account !== null);
	
			return accounts;
		}
		if (blacklist) {
			const accounts = HoyoLab.list.flatMap(platform => {
				if (blacklist && blacklist.includes(platform.name)) {
					return null;
				}
	
				return platform.accounts;
			}).filter(account => account !== null);
	
			return accounts;
		}

		return HoyoLab.list.flatMap(platform => platform.accounts);
	}

	static getActivePlatform () {
		return HoyoLab.list.map(platform => platform.name);
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
