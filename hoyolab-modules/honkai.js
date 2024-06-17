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

module.exports = class HonkaiImpact extends require("./template.js") {
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
			const { token, mid, ltuid } = account.cookie;
			if (!token || !mid || !ltuid) {
				throw new app.Error({
					message: "No cookie provided for Honkai Impact account",
					args: {
						cookie: account.cookie
					}
				});
			}

			const cookieData = `cookie_token_v2=${token}; account_mid_v2=${mid}; account_id_v2=${ltuid}`;

			const { body, statusCode } = await app.Got({
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

			const region = app.Utils.formattedAccountRegion(data.region);
			app.Logger.info(this.fullName, `Logged into (${data.game_role_id}) ${data.nickname} (${region})`);
		}
	}

	async checkAndExecute () {
		const accounts = this.accounts;
		if (accounts.length === 0) {
			app.Logger.warn("No active accounts found for Honkai Impact");
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

			if (data.isSigned) {
				app.Logger.info(`${this.fullName}:CheckIn`, `${account.nickname} already signed in today`);
				continue;
			}

			const totalSigned = data.total;
			const awardObject = {
				name: awards[totalSigned].name,
				count: awards[totalSigned].cnt,
				icon: awards[totalSigned].icon
			};

			const sign = await this.#sign(account.cookie);
			if (!sign.success) {
				continue;
			}

			app.Logger.info(`${this.fullName}:CheckIn`, `(${account.uid}) ${account.nickname} Today's Reward: ${awardObject.name} x${awardObject.count}`);

			success.push({
				uid: account.uid,
				platform: this.name,
				rank: account.level,
				username: account.nickname,
				region: app.Utils.formattedAccountRegion(account.region),
				total: data.total + 1,
				result: this.config.successMessage,
				assets: {
					...this.config.assets,
					logo: this.#logo,
					color: this.#color
				},
				award: awardObject
			});
		}

		return success;
	}

	async #sign (cookieData) {
		const res = await app.Got({
			url: this.config.url.sign,
			method: "POST",
			responseType: "json",
			searchParams: {
				act_id: this.config.ACT_ID
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.json(this.fullName, {
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
			app.Logger.json(this.fullName, {
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
		const res = await app.Got({
			url: this.config.url.info,
			responseType: "json",
			searchParams: {
				act_id: this.config.ACT_ID
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.json(this.fullName, {
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
			app.Logger.json(this.fullName, {
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
		const res = await app.Got({
			url: this.config.url.home,
			responseType: "json",
			searchParams: {
				act_id: this.config.ACT_ID
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.json(this.fullName, {
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
			app.Logger.json(this.fullName, {
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
					platform: this.name,
					body: res.body
				}
			});
		}

		return {
			success: true,
			data: data.awards
		};
	}

	get logo () { return this.#logo; }
	get color () { return this.#color; }
};
