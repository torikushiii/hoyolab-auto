const CheckIn = require("./check-in.js");
const Notes = require("./notes.js");
const RedeemCode = require("./redeem-code.js");

const DEFAULT_CONSTANTS = {
	ACT_ID: "e202406031448091",
	successMessage: "Congratulations Proxy! You have successfully checked in today!~",
	signedMessage: "You have already checked in today, Proxy!~",
	regenRate: 360,
	maxStamina: 240,
	assets: {
		author: "Eous",
		game: "Zenless Zone Zero"
	},
	url: {
		info: "https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/info",
		home: "https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/home",
		sign: "https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign",
		notes: "https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz/note",
		redemption: "https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey"
	}
};

module.exports = class ZenlessZoneZero extends require("../template.js") {
	#logo;
	#color;

	constructor (config) {
		super("nap", config, {
			gameId: 8,
			config: DEFAULT_CONSTANTS
		});

		if (!this.id) {
			throw new app.Error({
				message: "No game ID provided for ZenlessZoneZero."
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: "No ZenlessZoneZero account data provided."
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
					message: "Failed to login to Zenless Zone Zero account",
					args: {
						statusCode,
						body
					}
				});
			}

			const res = body;
			if (res.retcode !== 0) {
				throw new app.Error({
					message: "Failed to login to Zenless Zone Zero account",
					args: {
						retcode: res.retcode,
						message: res.message,
						res
					}
				});
			}

			if (typeof res.data !== "object" || !Array.isArray(res.data.list)) {
				throw new app.Error({
					message: "Invalid data object received from Zenless Zone Zero account",
					args: {
						data: res.data
					}
				});
			}

			const { list } = res.data;
			const data = list.find(account => account.game_id === this.gameId);
			if (!data) {
				throw new app.Error({
					message: "No Zenless Zone Zero account can be found with the provided game account",
					args: {
						id: this.id,
						uid: ltuid
					}
				});
			}

			this.#logo = data.logo;
			this.#color = 0xFF8300;

			this.accounts.push({
				platform: this.name,
				uid: data.game_role_id,
				nickname: data.nickname,
				region: data.region,
				level: data.level,
				redeemCode: account.redeemCode,
				dailiesCheck: account.dailiesCheck,
				game: {
					name: "Zenless Zone Zero",
					short: "ZZZ"
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
				shop: {
					check: account.shopStatus,
					fired: false
				},
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
};
