const CheckIn = require("./check-in.js");
const Diary = require("./diary.js");
const Notes = require("./notes.js");
const RedeemCode = require("./redeem-code.js");

const DEFAULT_CONSTANTS = {
	ACT_ID: "e202303301540311",
	successMessage: "You have successfully checked in today, Trailblazer~",
	signedMessage: "You've already checked in today, Trailblazer~",
	regenRate: 360,
	maxStamina: 240,
	assets: {
		author: "PomPom",
		game: "Honkai: Star Rail"
	},
	url: {
		info: "https://sg-public-api.hoyolab.com/event/luna/os/info",
		home: "https://sg-public-api.hoyolab.com/event/luna/os/home",
		sign: "https://sg-public-api.hoyolab.com/event/luna/os/sign",
		notes: "https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/note",
		diary: "https://sg-public-api.hoyolab.com/event/srledger/month_detail",
		redemption: "https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk"
	}
};

module.exports = class StarRail extends require("../template.js") {
	#logo;
	#color;

	constructor (config) {
		super("starrail", config, {
			gameId: 6,
			config: DEFAULT_CONSTANTS
		});

		if (!this.id) {
			throw new app.Error({
				message: "No HoyoLab ID provided for StarRail controller"
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: "No StarRail accounts provided"
			});
		}
	}

	async login () {
		const accounts = this.data;

		for (const account of accounts) {
			const cookieData = account.cookie;
			const ltuid = account.ltuid;

			const { body, statusCode } = await app.Got("HoYoLab", {
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
					message: "Failed to login to Honkai: Star Rail account",
					args: {
						statusCode,
						body
					}
				});
			}

			const res = body;
			if (res.retcode !== 0) {
				throw new app.Error({
					message: "Failed to login to Honkai: Star Rail account",
					args: {
						retcode: res.retcode,
						message: res.message,
						res
					}
				});
			}

			if (typeof res.data !== "object" || !Array.isArray(res.data.list)) {
				throw new app.Error({
					message: "Invalid data object received from Honkai: Star Rail account",
					args: {
						data: res.data
					}
				});
			}

			const { list } = res.data;
			const data = list.find(account => account.game_id === this.gameId);
			if (!data) {
				throw new app.Error({
					message: "No Honkai: Star Rail account can be found with the provided game account",
					args: {
						id: this.id,
						uid: ltuid
					}
				});
			}

			this.#logo = data.logo;
			this.#color = 0xBB0BB5;

			const offset = app.HoyoLab.getRegion(data.region);
			this.accounts.push({
				platform: this.name,
				uid: data.game_role_id,
				nickname: data.nickname,
				region: data.region,
				timezone: (offset === "TW/HK/MO") ? "SEA" : offset,
				level: data.level,
				redeemCode: account.redeemCode,
				dailiesCheck: account.dailiesCheck,
				weekliesCheck: account.weekliesCheck,
				cookie: cookieData,
				game: {
					name: "Honkai: Star Rail",
					short: "HSR"
				},
				discord: (account?.discord?.userId?.length === 0) ? null : account.discord,
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
				}
			});

			const region = app.HoyoLab.getRegion(data.region);
			app.Logger.info(this.fullName, `Logged into (${data.game_role_id}) ${data.nickname} (${region})`);
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
