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
			app.Logger.warn("No active accounts found for Genshin Impact");
			return;
		}

		const success = [];
		for (const account of accounts) {
			const info = await this.#getSignInfo(account.cookie);
			if (!info.success) {
				continue;
			}

			const awardsData = await this.#getAwardsData(account.cookie);
			if (!awardsData.success) {
				continue;
			}

			const awards = awardsData.data;
			const data = {
				total: info.data.total,
				today: info.data.today,
				isSigned: info.data.issign
			};

			const totalSigned = data.total;
			const awardObject = {
				name: awards[totalSigned].name,
				count: awards[totalSigned].cnt,
				icon: awards[totalSigned].icon
			};

			if (data.isSigned) {
				app.Logger.info(`${this.#instance.fullName}:CheckIn`, `${account.nickname} already signed in today`);

				success.push({
					uid: account.uid,
					platform: this.#instance.name,
					rank: account.level,
					username: account.nickname,
					region: app.HoyoLab.getRegion(account.region),
					total: data.total,
					result: this.#instance.config.signedMessage,
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
				continue;
			}

			app.Logger.info(`${this.#instance.fullName}:CheckIn`, `(${account.uid}) ${account.nickname} Today's Reward: ${awardObject.name} x${awardObject.count}`);

			success.push({
				uid: account.uid,
				platform: this.#instance.name,
				rank: account.level,
				username: account.nickname,
				region: app.HoyoLab.getRegion(account.region),
				total: data.total + 1,
				result: this.#instance.config.successMessage,
				assets: {
					...this.#instance.config.assets,
					logo: this.#logo,
					color: this.#color
				},
				award: awardObject
			});
		}

		return success;
	}

	async #sign (cookieData) {
		const res = await app.Got("HoYoLab", {
			url: this.#instance.config.url.sign,
			method: "POST",
			responseType: "json",
			searchParams: {
				act_id: this.#instance.config.ACT_ID
			},
			headers: {
				Cookie: cookieData,
				"x-rpc-signgame": "hk4e"
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.#instance.name}`, {
				message: "Failed to sign in",
				args: {
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.name}`, {
				message: "Failed to sign in",
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}

		return {
			success: true
		};
	}

	async #getSignInfo (cookieData) {
		const res = await app.Got("HoYoLab", {
			url: this.#instance.config.url.info,
			responseType: "json",
			searchParams: {
				act_id: this.#instance.config.ACT_ID
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(this.#instance.fullName, {
				message: "Failed to get sign info",
				args: {
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(this.#instance.fullName, {
				message: "Info returned non-zero retcode",
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}

		const data = res.body.data;
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
		const res = await app.Got("HoYoLab", {
			url: this.#instance.config.url.home,
			responseType: "json",
			searchParams: {
				act_id: this.#instance.config.ACT_ID
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(this.#instance.fullName, {
				message: "Failed to get awards data",
				args: {
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(this.#instance.fullName, {
				message: "Failed to get awards data",
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}

		const data = res.body.data;
		if (data.awards.length === 0) {
			throw new app.Error({
				message: "No awards data available (?)",
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
