const GENSHIN_MAX_STAMINA = 160;
const STARRAIL_MAX_STAMINA = 240;

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
			const { ltuid, ltoken } = account.cookie;
			if (!ltuid || !ltoken) {
				throw new app.Error({
					message: "Invalid cookie provided for HoyoLab.",
					args: {
						cookie: account.cookie
					}
				});
			}

			const { dailiesCheck, weekliesCheck } = account;
			if (typeof dailiesCheck !== "boolean" || typeof weekliesCheck !== "boolean") {
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

	static getAllActiveAccounts (options = {}) {
		const { whitelist, blacklist } = options;
		if (whitelist && blacklist) {
			throw new app.Error({
				message: "Cannot have both a whitelist and blacklist."
			});
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
	async notes (accountData) {
		throw new app.Error({
			message: "This method is not implemented by the derived class."
		});
	}

	static create (type, config) {
		let HoyoLabInstance;
		switch (type) {
			case "honkai":
				HoyoLabInstance = require("./honkai.js");
				break;
			case "genshin":
				HoyoLabInstance = require("./genshin.js");
				break;
			case "starrail":
				HoyoLabInstance = require("./starrail.js");
				break;
			default:
				throw new app.Error({
					message: "Invalid type provided.",
					args: {
						type
					}
				});
		}

		return new HoyoLabInstance(config);
	}
};
