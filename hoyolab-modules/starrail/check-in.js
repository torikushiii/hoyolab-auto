const { t } = require("../../localization/index.js");
const descriptor = require("./check-in-descriptor.js");

module.exports = class CheckIn {
	/** @type {import("../template")} */
	#instance;
	#logo;
	#color;

	constructor (instance, options = {}) {
		this.#instance = instance;
		this.#logo = options.logo;
		this.#color = options.color;
	}

	async checkAndExecute () {
		const accounts = this.#instance.accounts;
		if (accounts.length === 0) {
			app.Logger.warn(t("No active accounts found for Honkai: Star Rail"));
			return;
		}

		const results = [];
		for (const account of accounts) {
			const info = await this.#getSignInfo(account.cookie);
			if (!info.success) {
				results.push(this.#failure(account, info.reason));
				continue;
			}

			const awardsData = await this.#getAwardsData(account.cookie);
			if (!awardsData.success) {
				results.push(this.#failure(account, awardsData.reason));
				continue;
			}

			const awards = awardsData.data;
			const data = {
				total: info.data.total,
				today: info.data.today,
				isSigned: info.data.issign
			};

			const totalSigned = data.isSigned ? data.total - 1 : data.total;
			const awardObject = {
				name: awards[totalSigned].name,
				count: awards[totalSigned].cnt,
				icon: awards[totalSigned].icon
			};

			if (data.isSigned) {
				app.Logger.info(`${this.#instance.fullName}:CheckIn`, t `${account.nickname} already signed in today`);

				results.push({
					uid: account.uid,
					platform: this.#instance.name,
					rank: account.level,
					username: account.nickname,
					region: app.HoyoLab.getRegion(account.region),
					total: data.total,
					result: t(this.#instance.config.signedMessage),
					assets: {
						...this.#instance.config.assets,
						logo: this.#logo,
						color: this.#color
					},
					award: awardObject
				});
				continue;
			}

			const sign = await this.#sign(account.cookie);
			if (!sign.success) {
				results.push(this.#failure(account, sign.reason));
				continue;
			}

			const confirmation = await this.#getSignInfo(account.cookie);
			if (!confirmation.success || confirmation.data.issign !== true || confirmation.data.today !== data.today) {
				app.Logger.warn(`${this.#instance.fullName}:CheckIn`, "Check-in could not be confirmed for today");
				continue;
			}

			app.Logger.info(`${this.#instance.fullName}:CheckIn`, t `(${account.uid}) ${account.nickname} Today's Reward: ${awardObject.name} x${awardObject.count}`);

			results.push({
				uid: account.uid,
				platform: this.#instance.name,
				rank: account.level,
				username: account.nickname,
				region: app.HoyoLab.getRegion(account.region),
				total: confirmation.data.total,
				result: t(this.#instance.config.successMessage),
				assets: {
					...this.#instance.config.assets,
					logo: this.#logo,
					color: this.#color
				},
				award: awardObject
			});
		}

		return results;
	}

	#failure (account, reason) {
		return {
			failed: true,
			uid: account.uid,
			platform: this.#instance.name,
			rank: account.level,
			username: account.nickname,
			region: app.HoyoLab.getRegion(account.region),
			result: reason ?? t("Unknown error"),
			assets: {
				...this.#instance.config.assets,
				logo: this.#logo,
				color: this.#color
			}
		};
	}

	async #sign (cookieData) {
		const options = descriptor.signOptions(this.#instance.config.ACT_ID);
		const res = await app.Got(descriptor.profile, {
			...options,
			url: this.#instance.config.url.sign,
			responseType: "json",
			headers: { ...options.headers, Cookie: cookieData }
		});

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.#instance.name}`, {
				message: t("Failed to sign in"),
				args: {
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false,
				reason: `HTTP ${res.statusCode}`
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.name}`, {
				message: t("Failed to sign in"),
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false,
				reason: res.body.message || `retcode ${res.body.retcode}`
			};
		}

		return {
			success: true
		};
	}

	async #getSignInfo (cookieData) {
		const options = descriptor.readOptions(this.#instance.config.ACT_ID);
		const res = await app.Got(descriptor.profile, {
			...options,
			url: this.#instance.config.url.info,
			responseType: "json",
			headers: { ...options.headers, Cookie: cookieData }
		});

		if (res.statusCode !== 200) {
			app.Logger.log(this.#instance.fullName, {
				message: t("Failed to get sign info"),
				args: {
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false,
				reason: `HTTP ${res.statusCode}`
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(this.#instance.fullName, {
				message: t("Info returned non-zero retcode"),
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false,
				reason: res.body.message || `retcode ${res.body.retcode}`
			};
		}

		const data = res.body.data;
		if (!data || typeof data.is_sign !== "boolean" || !Number.isInteger(data.total_sign_day)
			|| data.total_sign_day < (data.is_sign ? 1 : 0) || typeof data.today !== "string" || !data.today) {
			app.Logger.warn(this.#instance.fullName, "Invalid sign info received");
			return { success: false };
		}
		return {
			success: true,
			data: {
				total: data.total_sign_day,
				today: data.today,
				issign: data.is_sign
			}
		};
	}

	async #getAwardsData (cookieData) {
		const options = descriptor.readOptions(this.#instance.config.ACT_ID);
		const res = await app.Got(descriptor.profile, {
			...options,
			url: this.#instance.config.url.home,
			responseType: "json",
			headers: { ...options.headers, Cookie: cookieData }
		});

		if (res.statusCode !== 200) {
			app.Logger.log(this.#instance.fullName, {
				message: t("Failed to get awards data"),
				args: {
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false,
				reason: `HTTP ${res.statusCode}`
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(this.#instance.fullName, {
				message: t("Failed to get awards data"),
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false,
				reason: res.body.message || `retcode ${res.body.retcode}`
			};
		}

		const data = res.body.data;
		if (data.awards.length === 0) {
			throw new app.Error({
				message: t("No awards data available (?)"),
				args: {
					platform: this.#instance.name,
					body: res.body
				}
			});
		}

		return {
			success: true,
			data: data.awards
		};
	}
};
