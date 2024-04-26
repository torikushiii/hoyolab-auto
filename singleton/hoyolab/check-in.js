module.exports = class CheckIn extends require("./template") {
	#account = null;
	#platform = null;

	static ACT_ID = {
		genshin: "e202102251931481",
		starrail: "e202303301540311"
	};

	static strings = {
		genshin: {
			success: "Congratulations, Traveler! You have successfully checked in today~",
			signed: "Traveler, you've already checked in today~"
		},
		starrail: {
			success: "You have successfully checked in today, Trailblazer~",
			signed: "You've already checked in today, Trailblazer~"
		}
	};

	static url = {
		genshin: {
			info: "https://sg-hk4e-api.hoyolab.com/event/sol/info",
			home: "https://sg-hk4e-api.hoyolab.com/event/sol/home",
			sign: "https://sg-hk4e-api.hoyolab.com/event/sol/sign"
		},
		starrail: {
			info: "https://sg-public-api.hoyolab.com/event/luna/os/info",
			home: "https://sg-public-api.hoyolab.com/event/luna/os/home",
			sign: "https://sg-public-api.hoyolab.com/event/luna/os/sign"
		}
	};

	constructor (options) {
		super();
		
		if (typeof options.account !== "object") {
			throw new app.Error({
				messagge: "Invalid account object provided to CheckIn constructor",
				args: {
					account: options.account,
					platform: options.platform
				}
			});
		}

		this.#account = options.account;
		this.#platform = options.platform;
	}

	async checkAndExecute () {
		const cookieData = app.Account.getAccountCookie(this.#account.id);
		const info = await this.getSignInfo(cookieData);
		if (!info.success) {
			app.Account.setAccountProperty(this.#account.id, "failed", true);
			return;
		}

		const awardsData = await this.getAwardsData(cookieData);
		if (!awardsData.success) {
			app.Account.setAccountProperty(this.#account.id, "failed", true);
			return;
		}

		const awards = awardsData.data;
		const data = {
			today: info.data.today,
			total: info.data.total,
			isSigned: info.data.issign
		};

		const accountData = app.Account.get(this.#account.id);
		if (data.isSigned) {
			app.Logger.info(`HoyoLab:CheckIn:${this.#platform}`, `${accountData.username} already signed in today`);
			app.Account.setAccountProperty(this.#account.id, "failed", false);
			
			return {
				uid: accountData.uid,
				platform: this.#platform,
				rank: accountData.rank,
				username: accountData.username,
				region: accountData.region,
				total: data.total,
				result: CheckIn.strings[this.#platform].signed,
				award: {
					name: awards[data.total].name,
					count: awards[data.total].cnt,
					icon: awards[data.total].icon
				}
			};
		}

		const totalSigned = data.total;
		const awardData = {
			name: awards[totalSigned].name,
			count: awards[totalSigned].cnt,
			icon: awards[totalSigned].icon
		};

		const sign = await this.sign(cookieData);
		if (!sign.success) {
			app.Account.setAccountProperty(this.#account.id, "failed", true);
			return;
		}

		app.Account.setAccountProperty(this.#account.id, "failed", false);
		app.Logger.info(`HoyoLab:CheckIn:${this.#platform}`, `${accountData.username} ${awardData.name} x${awardData.count}`);

		return {
			uid: accountData.uid,
			platform: this.#platform,
			username: accountData.username,
			rank: accountData.rank,
			region: accountData.region,
			total: data.total + 1,
			result: CheckIn.strings[this.#platform].success,
			award: awardData
		};
	}

	async sign (cookieData) {
		const platform = this.#platform;
		const res = await app.Got({
			url: CheckIn.url[platform].sign,
			method: "POST",
			responseType: "json",
			searchParams: {
				act_id: CheckIn.ACT_ID[platform]
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.error("HoyoLab:CheckIn", {
				message: "Failed to sign in",
				args: {
					platform,
					status: res.statusCode,
					body: res.body
				}
			});

			return { success: false };
		}
		if (res.body.retcode !== 0) {
			app.Logger.error("HoyoLab:CheckIn", {
				message: "Sign returned non-zero retcode",
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return { success: false };
		}

		return { success: true };
	}

	async getSignInfo (cookieData) {
		const platform = this.#platform;
		const res = await app.Got({
			url: CheckIn.url[platform].info,
			responseType: "json",
			searchParams: {
				act_id: CheckIn.ACT_ID[platform]
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.error("HoyoLab:CheckIn", {
				message: "Failed to get sign info",
				args: {
					platform,
					status: res.statusCode,
					body: res.body
				}
			});
            
			return { success: false };
		}
		if (res.body.retcode !== 0) {
			app.Logger.error("HoyoLab:CheckIn", {
				message: "Info returned non-zero retcode",
				args: {
					status: res.body.retcode,
					body: res.body
				}
			});

			return { success: false };
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

	async getAwardsData (cookieData) {
		const platform = this.#platform;
		const res = await app.Got({
			url: CheckIn.url[platform].home,
			responseType: "json",
			searchParams: {
				act_id: CheckIn.ACT_ID[platform]
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.error("HoyoLab:CheckIn", {
				message: "Failed to get awards data",
				args: {
					platform,
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.error("HoyoLab:CheckIn", {
				message: "Awards returned non-zero retcode",
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
				message: "No awards available (?)",
				args: {
					platform,
					data
				}
			});
		}

		return {
			success: true,
			data: data.awards
		};
	}
};
