const { t } = require("../../localization/index.js");

const CheckIn = require("./check-in.js");
const checkInDescriptor = require("./check-in-descriptor.js");
const Diary = require("./diary.js");
const Notes = require("./notes.js");
const { REDEMPTION_URL } = require("./redemption-request.js");
const RedeemCode = require("./redeem-code.js");
const TravelingMimo = require("./mimo.js");
const HilichurlWorkshop = require("./hilichurl.js");

const DEFAULT_CONSTANTS = {
	ACT_ID: checkInDescriptor.actId,
	successMessage: "Congratulations, Traveler! You have successfully checked in today~",
	signedMessage: "Traveler, you've already checked in today~",
	regenRate: 480,
	maxStamina: 200,
	assets: {
		author: "Paimon",
		game: "Genshin Impact"
	},
	url: {
		...checkInDescriptor.urls,
		notes: "https://sg-act-public-api.hoyolab.com/event/game_record/app/genshin/api/dailyNote",
		diary: "https://sg-act-public-api.hoyolab.com/event/ysledgeros/month_info",
		redemption: REDEMPTION_URL
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
				message: t("No HoyoLab ID provided for Genshin controller")
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: t("No Genshin accounts provided")
			});
		}
	}

	async login () {
		const accounts = this.data;

		for (const account of accounts) {
			const cookieData = account.cookie;
			const ltuid = account.ltuid;

			const { body, statusCode } = await app.Got("HoYoLabGameRecordDesktopWeb", {
				url: "https://sg-act-public-api.hoyolab.com/event/game_record/card/wapi/getGameRecordCard",
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
					message: t("Failed to login to Genshin account"),
					args: {
						statusCode,
						body
					}
				});
			}

			const res = body;
			if (res.retcode !== 0) {
				throw new app.Error({
					message: t("Failed to login to Genshin account"),
					args: {
						retcode: res.retcode,
						message: res.message,
						res
					}
				});
			}

			if (typeof res.data !== "object" || !Array.isArray(res.data.list)) {
				throw new app.Error({
					message: t("Invalid data object received from Genshin account"),
					args: {
						data: res.data
					}
				});
			}

			const { list } = res.data;
			const data = list.find(account => account.game_id === this.gameId);
			if (!data) {
				throw new app.Error({
					message: t("No Genshin account can be found with the provided game account"),
					args: {
						id: this.id,
						uid: ltuid
					}
				});
			}

			this.#logo = data.logo;
			this.#color = 0x0099FF;

			const offset = app.HoyoLab.getRegion(data.region);
			this.accounts.push({
				platform: this.name,
				uid: data.game_role_id,
				nickname: data.nickname,
				region: data.region,
				timezone: (offset === "TW/HK/MO") ? "SEA" : offset,
				level: data.level,
				redeemCode: account.redeemCode,
				redeemCodeConfigured: account.redeemCodeConfigured,
				dailiesCheck: account.dailiesCheck,
				weekliesCheck: account.weekliesCheck,
				cookie: cookieData,
				game: {
					name: "Genshin Impact",
					short: "GI"
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
				},
				realm: {
					check: account.realm.check ?? false,
					persistent: account.realm.persistent ?? false,
					fired: false
				},
				mimo: {
					check: account.mimo?.check ?? false,
					lastRun: null
				},
				hilichurl: {
					check: account.hilichurl?.check ?? false,
					redeem: account.hilichurl?.redeem ?? true,
					lastRun: null
				},
				allowedPlatforms: account.allowedPlatforms ?? null
			});

			const region = app.HoyoLab.getRegion(data.region);
			app.Logger.info(this.fullName, t `Logged into (${data.game_role_id}) ${data.nickname} (${region})`);
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

	async mimo (accountData) {
		const tm = new TravelingMimo(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await tm.run(accountData);
	}

	async mimoGetRestockTime (accountData) {
		const tm = new TravelingMimo(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await tm.getNextRestockTime(accountData);
	}

	async hilichurl (accountData) {
		const hw = new HilichurlWorkshop(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await hw.run(accountData);
	}

	async hilichurlGetRestockTime (accountData) {
		const hw = new HilichurlWorkshop(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await hw.getNextRestockTime(accountData);
	}
};
