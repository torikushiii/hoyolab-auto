module.exports = class Account extends require("./template.js") {
	static data = new Map();
	
	static genshin = false;
	static starrail = false;
    
	constructor (data) {
		super();

		if (typeof data !== "object") {
			throw new app.Error({ message: "Account data must be an object." });
		}

		this.id = data.id;
		if (typeof this.id !== "number") {
			throw new app.Error({
				message: "Account ID must be a number.",
				args: { id: data.id }
			});
		}

		this.type = data.type;
		if (typeof this.type !== "string") {
			throw new app.Error({
				message: "Account type must be a string.",
				args: { type: data.type }
			});
		}

		this.uid = data.uid;
		if (typeof this.uid !== "string") {
			throw new app.Error({
				message: "Account UID must be a string.",
				args: { uid: data.uid }
			});
		}

		this.rank = data.rank;
		if (typeof this.rank !== "number") {
			throw new app.Error({
				message: "Account rank must be a number.",
				args: { rank: data.rank }
			});
		}

		this.username = data.username;
		if (typeof this.username !== "string") {
			throw new app.Error({
				message: "Account username must be a string.",
				args: { username: data.username }
			});
		}
		this.region = data.region;
		if (typeof this.region !== "string") {
			throw new app.Error({
				message: "Account region must be a string.",
				args: { region: data.region }
			});
		}

		this.cookie = data.cookie;
		if (typeof this.cookie === "object") {
			const { ltoken, ltuid } = this.cookie;
			if (!ltoken || typeof ltoken !== "string") {
				throw new app.Error({
					message: "Account cookie ltoken must be a string.",
					args: { ltoken }
				});
			}
			if (!ltuid || typeof ltuid !== "string") {
				throw new app.Error({
					message: "Account cookie ltuid must be a string.",
					args: { ltuid }
				});
			}
		}
		else {
			throw new app.Error({
				message: "Account cookie data must be an object.",
				args: { cookie: data.cookie }
			});
		}
		
		this.config = data.config;
		if (typeof this.config === "object") {
			const { check, threshold, persistent } = this.config.stamina;
			if (typeof check !== "boolean") {
				throw new app.Error({
					message: "Account stamina check must be a boolean.",
					args: { check }
				});
			}
			
			if (typeof threshold === "number" && this.type === "genshin" && (threshold < 0 || threshold > 160)) {
				throw new app.Error({
					message: "Account stamina threshold must be between 0 and 160.",
					args: { threshold }
				});
			}
			else if (typeof threshold === "number" && this.type === "starrail" && (threshold < 0 || threshold > 240)) {
				throw new app.Error({
					message: "Account stamina threshold must be between 0 and 240.",
					args: { threshold }
				});
			}

			if (threshold === 0 && check === true) {
				throw new app.Error({
					message: "Account stamina threshold cannot be 0. Disable stamina check instead.",
					args: { threshold }
				});
			}

			if (typeof persistent !== "boolean") {
				throw new app.Error({
					message: "Account stamina persistent must be a boolean.",
					args: { persistent }
				});
			}

			const { check: expeditionCheck, persistent: expeditionPersistent } = this.config.expedition;
			if (typeof expeditionCheck !== "boolean") {
				throw new app.Error({
					message: "Account expedition check must be a boolean.",
					args: { expeditionCheck }
				});
			}

			if (typeof expeditionPersistent !== "boolean") {
				throw new app.Error({
					message: "Account expedition persistent must be a boolean.",
					args: { expeditionPersistent }
				});
			}

			const { dailiesCheck, weekliesCheck } = this.config;
			if (typeof dailiesCheck !== "boolean") {
				throw new app.Error({
					message: "Account dailies check must be a boolean.",
					args: { dailiesCheck }
				});
			}

			if (typeof weekliesCheck !== "boolean") {
				throw new app.Error({
					message: "Account weeklies check must be a boolean.",
					args: { weekliesCheck }
				});
			}
		}
		else {
			throw new app.Error({
				message: "Account config data must be an object.",
				args: { config: data.config }
			});
		}
	}

	static async initialize (data) {
		Account.data = new Map();
		await Account.loadData(data);
		return Account;
	}

	static async loadData (data) {
		if (!Array.isArray(data)) {
			throw new app.Error({ message: "Account data must be an array." });
		}
		else if (data.length === 0) {
			throw new app.Error({ message: "Account data array is empty." });
		}

		this.genshin = app.Config.get("genshin");
		this.starrail = app.Config.get("starrail");
		if (!this.genshin && !this.starrail) {
			throw new app.Error({
				message: "All account types are disabled. Please enable at least one account type in the configuration."
			});
		}

		const enabledAccounts = data.filter(i => this[i.type]);
		for (const account of enabledAccounts) {
			const validTypes = ["genshin", "starrail", "honkai"];
			if (!validTypes.includes(account.type)) {
				throw new app.Error({ message: `Invalid account type: ${account.type}` });
			}

			if (account.data.length === 0) {
				app.Logger.warn("AccountManager", `Account ${account.type} has no data. Skipping...`);
			}

			for (const acc of account.data) {
				const id = Account.data.size + 1;
				
				const { ltoken, ltuid } = acc.cookie;
				if (!ltoken || !ltuid) {
					throw new app.Error({
						message: `Account ${id} (${account.type}) is missing cookie data.`
					});
				}

				const res = await this.login(false, { ltoken, ltuid });
				if (res.success === false) {
					app.Logger.warn("AccountManager", `Account ${id} (${account.type}) failed to login: ${res.message}`);
					continue;
				}

				if (res.data.list.length === 0) {
					app.Logger.warn("AccountManager", `Account ${id} (${account.type}) has no game records. Skipping...`);
					continue;
				}

				const getGameData = this.parseGameData(ltuid, res.data.list, account.type);
				if (getGameData.length === 0) {
					app.Logger.warn("AccountManager", `Account ${id} (${account.type}) has no game data found. Skipping...`);
					continue;
				}

				for (const data of getGameData) {
					const accountData = new Account({
						id,
						type: account.type,
						...data,
						...acc,
						cookie: {
							v2: res.isV2,
							ltoken,
							ltuid
						},
						config: {
							stamina: acc.stamina,
							expedition: acc.expedition,
							dailiesCheck: acc.dailiesCheck,
							weekliesCheck: acc.weekliesCheck
						}
					});

					Account.data.set(id, accountData);
				}
			}
		}

		if (Account.data.size === 0) {
			throw new app.Error({ message: "No accounts loaded." });
		}

		app.Logger.log("AccountManager", `Loaded ${Account.data.size} accounts.`);
	}

	static parseGameData (ltuid, data, type) {
		const gameTypes = {
			genshin: 2,
			starrail: 6
		};

		const gameData = data.filter(i => i.game_id === gameTypes[type]);
		if (gameData.length === 0) {
			app.Logger.warn("AccountManager", `Account ${ltuid} (${type}) has no game data found (?)`);
			app.Logger.warn("AccountManager", { ltuid, type, data });
			return [];
		}

		const records = [];
		for (const game of gameData) {
			records.push({
				uid: game.game_role_id,
				username: game.nickname,
				rank: game.level,
				region: game.region
			});
		}

		return records;
	}

	static async login (isv2 = false, { ltoken, ltuid }) {
		const cookie = `ltoken${isv2 ? "_v2" : ""}=${ltoken}; ltuid${isv2 ? "_v2" : ""}=${ltuid}`;
		
		const res = await app.Got({
			url: "https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				uid: ltuid
			},
			headers: {
				Cookie: cookie
			}
		});

		if (res.statusCode !== 200) {
			throw new app.Error({
				message: `Failed to login to account ${ltuid}`,
				args: {
					statusCode: res.statusCode,
					body: res.body
				}
			});
		}

		if (res.body.data === null && isv2 === false) {
			return await this.login(true, { ltoken, ltuid });
		}
		else if (res.body.data === null && isv2 === true) {
			app.Logger.error("AccountManager", { response: res.body });
			
			return {
				success: false,
				code: res.body.retcode,
				message: res.body.message
			};
		}

		return {
			success: true,
			isV2: isv2,
			data: res.body.data
		};
	}

	static get (id) {
		if (!id || typeof id !== "number") {
			throw new app.Error({
				message: "Account ID must be a number.",
				args: { id }
			});
		}

		const account = Account.data.get(id);
		if (!account) {
			throw new app.Error({
				message: `Account ${id} not found.`,
				args: { id }
			});
		}

		return account;
	}

	static getAccountCookie (id) {
		if (!id || typeof id !== "number") {
			throw new app.Error({
				message: "Account ID must be a number.",
				args: { id }
			});
		}

		const account = Account.data.get(id);
		if (!account) {
			throw new app.Error({
				message: `Account ${id} not found.`,
				args: { id }
			});
		}

		const ltoken = `ltoken${account.cookie.v2 ? "_v2" : ""}=${account.cookie.ltoken}`;
		const ltuid = `ltuid${account.cookie.v2 ? "_v2" : ""}=${account.cookie.ltuid}`;

		return `${ltoken}; ${ltuid}`;
	}

	static getAccountProperty (id, key) {
		if (!id || typeof id !== "number") {
			throw new app.Error({
				message: "Account ID must be a number.",
				args: { id }
			});
		}

		const account = Account.data.get(id);
		if (!account) {
			throw new app.Error({
				message: `Account ${id} not found.`,
				args: { id }
			});
		}

		if (!key || typeof key !== "string") {
			throw new app.Error({
				message: "Account key must be a string.",
				args: { key }
			});
		}

		return account[key];
	}

	static setAccountProperty (id, key, value) {
		if (!id || typeof id !== "number") {
			throw new app.Error({
				message: "Account ID must be a number.",
				args: { id }
			});
		}

		const account = Account.data.get(id);
		if (!account) {
			throw new app.Error({
				message: `Account ${id} not found.`,
				args: { id }
			});
		}

		if (!key || typeof key !== "string") {
			throw new app.Error({
				message: "Account key must be a string.",
				args: { key }
			});
		}

		if (typeof value === "undefined") {
			throw new app.Error({
				message: "Account value must be defined.",
				args: { value }
			});
		}

		account[key] = value;
	}

	static getActivePlatforms (platform) {
		if (typeof platform !== "undefined" && typeof platform !== "string") {
			throw new app.Error({
				message: "Platform must be a string.",
				args: {
					platform,
					type: typeof platform
				}
			});
		}

		if (!platform) {
			return Array.from(Account.data.values()).map(i => ({
				id: i.id,
				username: i.username,
				type: i.type
			}));
		}

		const accounts = Array.from(Account.data.values());
		return accounts.filter(i => i.type === platform);
	}
};
