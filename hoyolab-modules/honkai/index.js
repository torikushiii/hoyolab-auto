const CheckIn = require("./check-in.js");

const DEFAULT_CONSTANTS = {
	ACT_ID: "e202110291205111",
	successMessage: "You have successfully checked in today, Captain~",
	signedMessage: "You've already checked in today, Captain~",
	assets: {
		author: "Kiana",
		game: "Honkai Impact 3rd"
	},
	url: {
		info: "https://sg-public-api.hoyolab.com/event/mani/info",
		home: "https://sg-public-api.hoyolab.com/event/mani/home",
		sign: "https://sg-public-api.hoyolab.com/event/mani/sign"
	}
};

module.exports = class HonkaiImpact extends require("../template.js") {
	#logo;
	#color;

	constructor (config) {
		super("honkai", config, {
			gameId: 1,
			config: DEFAULT_CONSTANTS
		});

		if (!this.id) {
			throw new app.Error({
				message: "No HoyoLab ID provided for Honkai Impact controller"
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: "No Honkai Impact accounts provided"
			});
		}
	}

	async login () {
		const accounts = this.data;

		for (const account of accounts) {
			const cookieData = account.cookie;
			const ltuid = account.ltuid;

			const { body, statusCode } = await app.Got("MiHoYo", {
				url: "https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard",
				responseType: "json",
				throwHttpErrors: false,
				searchParams: {
					uid: ltuid
				},
				headers: {
					Cookie: cookieData
				}
			});

			if (statusCode !== 200) {
				throw new app.Error({
					message: "Failed to login to Honkai Impact account",
					args: {
						statusCode,
						body
					}
				});
			}

			const res = body;
			if (res.retcode !== 0) {
				throw new app.Error({
					message: "Failed to login to Honkai Impact account",
					args: {
						retcode: res.retcode,
						message: res.message,
						res
					}
				});
			}

			if (typeof res.data !== "object" || !Array.isArray(res.data.list)) {
				throw new app.Error({
					message: "Invalid data object received from Honkai Impact account",
					args: {
						data: res.data
					}
				});
			}

			const { list } = res.data;
			const data = list.find(account => account.game_id === this.gameId);
			if (!data) {
				throw new app.Error({
					message: "No Honkai Impact account can be found with the provided game account",
					args: {
						id: this.id,
						uid: ltuid
					}
				});
			}

			this.#logo = data.logo;
			this.#color = 0xF7E000;

			this.accounts.push({
				platform: this.name,
				uid: data.game_role_id,
				nickname: data.nickname,
				region: data.region,
				level: data.level,
				cookie: cookieData
			});

			const region = app.HoyoLab.getRegion(data.region);
			app.Logger.info(this.fullName, `Logged into (${data.game_role_id}) ${data.nickname} (${region})`);
		}
	}

	get logo () { return this.#logo; }
	get color () { return this.#color; }

	async checkIn () {
		const ci = new CheckIn(this, {
			logo: this.logo,
			color: this.color
		});

		return await ci.checkAndExecute();
	}
};
