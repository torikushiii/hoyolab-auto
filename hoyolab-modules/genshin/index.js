const CheckIn = require("./check-in.js");
const Diary = require("./diary.js");
const Notes = require("./notes.js");
const RedeemCode = require("./redeem-code.js");

const DEFAULT_CONSTANTS = {
	ACT_ID: "e202102251931481",
	successMessage: "Congratulations, Traveler! You have successfully checked in today~",
	signedMessage: "Traveler, you've already checked in today~",
	regenRate: 480,
	maxStamina: 200,
	assets: {
		author: "Paimon",
		game: "Genshin Impact"
	},
	url: {
		info: "https://sg-hk4e-api.hoyolab.com/event/sol/info",
		home: "https://sg-hk4e-api.hoyolab.com/event/sol/home",
		sign: "https://sg-hk4e-api.hoyolab.com/event/sol/sign",
		notes: "https://bbs-api-os.mihoyo.com/game_record/genshin/api/dailyNote",
		diary: "https://sg-hk4e-api.hoyolab.com/event/ysledgeros/month_detail",
		redemption: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey"
	}
};

module.exports = class Genshin extends require("../template.js") {
	#logo;
	#color;

	constructor (config) {
		super("genshin", config, {
			gameId: 2,
			config: DEFAULT_CONSTANTS
		});

		if (!this.id) {
			throw new app.Error({
				message: "No HoyoLab ID provided for Genshin controller"
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: "No Genshin accounts provided"
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
					message: "Failed to login to Genshin account",
					args: {
						statusCode,
						body
					}
				});
			}

			const res = body;
			if (res.retcode !== 0) {
				throw new app.Error({
					message: "Failed to login to Genshin account",
					args: {
						retcode: res.retcode,
						message: res.message,
						res
					}
				});
			}

			if (typeof res.data !== "object" || !Array.isArray(res.data.list)) {
				throw new app.Error({
					message: "Invalid data object received from Genshin account",
					args: {
						data: res.data
					}
				});
			}

			const { list } = res.data;
			const data = list.find(account => account.game_id === this.gameId);
			if (!data) {
				throw new app.Error({
					message: "No Genshin account can be found with the provided game account",
					args: {
						id: this.id,
						uid: ltuid
					}
				});
			}

			this.#logo = data.logo;
			this.#color = 0x0099FF;

			this.accounts.push({
				platform: this.name,
				uid: data.game_role_id,
				nickname: data.nickname,
				region: data.region,
				level: data.level,
				redeemCode: account.redeemCode,
				dailiesCheck: account.dailiesCheck,
				weekliesCheck: account.weekliesCheck,
				cookie: cookieData,
				game: {
					name: "Genshin Impact",
					short: "GI"
				},
				assets: {
					...this.config.assets,
					...this.config.url,
					logo: this.#logo,
					color: this.#color
				},
				stamina: {
					...account.stamina,
					fired: false
				},
				expedition: {
					...account.expedition,
					fired: false
				},
				realm: {
					check: account.realm.check ?? false,
					persistent: account.realm.persistent ?? false,
					fired: false
				}
			});

			const region = app.HoyoLab.getRegion(data.region);
			app.Logger.info(this.fullName, `Logged into (${data.game_role_id}) ${data.nickname} (${region})`);
		}
	}

	get logo () { return this.#logo; }
	get color () { return this.#color; }

	async checkIn () {
		const ci = new CheckIn(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await ci.checkAndExecute();
	}

	async notes (accountData) {
		const rn = new Notes(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await rn.notes(accountData);
	}

	async redeemCode (accountData, code) {
		const rc = new RedeemCode(this);
		return await rc.redeemCode(accountData, code);
	}

	async diary (accountData) {
		const d = new Diary(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await d.diary(accountData);
	}
};
