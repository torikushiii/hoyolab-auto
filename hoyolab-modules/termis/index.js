const CheckIn = require("./check-in.js");

const DEFAULT_CONSTANTS = {
	ACT_ID: "e202202281857121",
	successMessage: "Successfully signed in",
	signedMessage: "Already signed in today",
	assets: {
		author: "Luke",
		game: "Tears of Themis"
	},
	url: {
		info: "https://sg-public-api.hoyolab.com/event/luna/os/info",
		home: "https://sg-public-api.hoyolab.com/event/luna/os/home",
		sign: "https://sg-public-api.hoyolab.com/event/luna/os/sign"
	}
};

module.exports = class TearsOfThemis extends require("../template.js") {
	#logo;
	#color;

	constructor (config) {
		super("tot", config, {
			gameId: 0,
			config: DEFAULT_CONSTANTS
		});

		if (!this.id) {
			throw new app.Error({
				message: "No HoyoLab ID provided for TearsOfThemis controller"
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: "No TearsOfThemis accounts provided"
			});
		}
	}

	async login () {
		const accounts = this.data;

		let accountList = 0;
		for (const account of accounts) {
			const cookieData = account.cookie;
			const ltuid = account.ltuid;

			this.#logo = "https://hyl-static-res-prod.hoyolab.com/communityweb/business/nxx_hoyoverse.png";
			this.#color = 0xFF8300;

			this.accounts.push({
				platform: this.name,
				uid: ltuid,
				nickname: "",
				region: "Global",
				timezone: "GLOBAL",
				level: "",
				cookie: cookieData,
				game: {
					name: "Tears of Themis",
					short: "ToT"
				},
				assets: {
					...this.config.assets,
					...this.config.url,
					logo: this.#logo,
					color: this.#color
				}
			});

			accountList++;
			app.Logger.info(this.fullName, `Logged into account ${accountList} [${ltuid}] (Tears of Themis)`);
		}
	}

	get logo () { return this.#logo; }
	get color () { return this.#color; }

	async checkIn (accountData) {
		const ci = new CheckIn(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await ci.checkAndExecute(accountData);
	}
};
