module.exports = class Expedition extends require("./template") {
	#account = null;
	#platform = null;

	constructor (options) {
		super();

		if (typeof options.account !== "object") {
			throw new app.Error({
				messagge: "Invalid account object provided to Expedition constructor",
				args: {
					account: options.account,
					platform: options.platform
				}
			});
		}

		this.#account = options.account;
		this.#platform = options.platform;
	}

	async checkAndExecute (options = {}) {
		if (options.check === false) {
			return;
		}

		const accountData = app.Account.get(this.#account.id);
		const notes = await app.HoyoLab.getNotes(this.#account, this.#platform, {
			uid: accountData.uid,
			region: accountData.region
		});

		if (!notes.success) {
			return;
		}

		const expedition = notes.expedition;
		if (expedition.list.length === 0) {
			return [];
		}

		const isAllCompleted = expedition.completed;
		if (!isAllCompleted) {
			app.Account.setAccountProperty(this.#account.id, "expeditionFired", false);
			return [];
		}

		const fired = app.Account.getAccountProperty(this.#account.id, "expeditionFired");
		if (fired && options.persistent) {
			return {
				uid: accountData.uid,
				username: accountData.username,
				platform: this.#platform,
				expedition
			};
		}

		if (fired) {
			return [];
		}

		app.Account.setAccountProperty(this.#account.id, "expeditionFired", true);
		return {
			uid: accountData.uid,
			username: accountData.username,
			platform: this.#platform,
			expedition
		};
	}
};
