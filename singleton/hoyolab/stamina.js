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

		const stamina = notes.stamina;

		const fired = app.Account.getAccountProperty(this.#account.id, "staminaFired");
		if (fired && stamina.currentStamina < options.threshold) {
			app.Account.setAccountProperty(this.#account.id, "staminaFired", false);
			return null;
		}
		if (fired && options.persistent) {
			return {
				...stamina,
				uid: accountData.uid,
				username: accountData.username,
				platform: this.#platform
			};
		}

		if (fired) {
			return null;
		}

		if (stamina.currentStamina > options.threshold) {
			app.Account.setAccountProperty(this.#account.id, "staminaFired", true);
			return {
				...stamina,
				uid: accountData.uid,
				username: accountData.username,
				platform: this.#platform
			};
		}

		return null;
	}
};
