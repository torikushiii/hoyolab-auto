const { t } = require("../../localization/index.js");

const CheckIn = require("./check-in.js");
const Diary = require("./diary.js");
const Notes = require("./notes.js");
const RedeemCode = require("./redeem-code.js");
const TravelingMimo = require("./mimo.js");
const HilichurlWorkshop = require("./hilichurl.js");

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
		redemption: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
		roles: "https://api-account-os.hoyoverse.com/account/binding/api/getUserGameRolesByCookie"
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
			const redeemTargets = await this.#getRedeemTargets(account, data);
			this.accounts.push({
				platform: this.name,
				uid: data.game_role_id,
				nickname: data.nickname,
				region: data.region,
				timezone: (offset === "TW/HK/MO") ? "SEA" : offset,
				level: data.level,
				redeemCode: account.redeemCode,
				redeemCodeConfigured: account.redeemCodeConfigured,
				redeemTargets,
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

	// Characters that receive auto-redeemed codes, main server first. See docs/REDEEM_REGIONS.md.
	// Returns null when neither mainRegion nor redeemRegions is configured, so redemption keeps using the card character only.
	async #getRedeemTargets (account, card) {
		const mainRegion = account.mainRegion ?? "default";
		const regions = account.redeemRegions;
		if (mainRegion === "default" && regions.length === 0) {
			return null;
		}

		const { body, statusCode } = await app.Got("HoYoLab", {
			url: this.config.url.roles,
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				game_biz: "hk4e_global"
			},
			headers: {
				Cookie: app.HoyoLab.parseCookie(account.cookie, {
					whitelist: ["cookie_token_v2", "account_mid_v2", "account_id_v2", "cookie_token", "account_id"]
				})
			}
		});

		const roles = body?.data?.list;
		if (statusCode !== 200 || body?.retcode !== 0 || !Array.isArray(roles)) {
			app.Logger.warn(this.fullName, {
				message: t `Could not fetch Genshin characters for redeemRegions, redeeming codes on (${card.game_role_id}) only`,
				args: { statusCode, retcode: body?.retcode, message: body?.message }
			});
			return null;
		}

		const toTarget = role => ({
			uid: role.game_uid,
			nickname: role.nickname,
			region: role.region,
			level: role.level
		});

		let main = { uid: card.game_role_id, nickname: card.nickname, region: card.region, level: card.level };
		if (mainRegion !== "default") {
			const role = roles.find(i => i.region === mainRegion);
			if (role) {
				main = toTarget(role);
			}
			else {
				app.Logger.warn(this.fullName, t `No Genshin character found on ${mainRegion}, using (${card.game_role_id}) as main redemption server`);
			}
		}

		const targets = [main];
		for (const region of regions) {
			if (region === main.region) {
				continue;
			}

			const role = roles.find(i => i.region === region);
			if (!role) {
				app.Logger.warn(this.fullName, t `No Genshin character found on ${region} for (${card.game_role_id}), skipping it for code redemption`);
				continue;
			}

			targets.push(toTarget(role));
		}

		return targets;
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
