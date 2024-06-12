const DEFAULT_CONSTANTS = {
	ACT_ID: "e202102251931481",
	successMessage: "Congratulations, Traveler! You have successfully checked in today~",
	signedMessage: "Traveler, you've already checked in today~",
	assets: {
		author: "Paimon",
		game: "Genshin Impact"
	},
	url: {
		info: "https://sg-hk4e-api.hoyolab.com/event/sol/info",
		home: "https://sg-hk4e-api.hoyolab.com/event/sol/home",
		sign: "https://sg-hk4e-api.hoyolab.com/event/sol/sign",
		notes: "https://bbs-api-os.mihoyo.com/game_record/genshin/api/dailyNote",
		redemption: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey"
	}
};

module.exports = class Genshin extends require("./template.js") {
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

		this.dataCache.startExpirationInterval();
	}

	async login () {
		const accounts = this.data;
        
		for (const account of accounts) {
			const { token, mid, ltuid } = account.cookie;
			if (!token || !mid || !ltuid) {
				throw new app.Error({
					message: "No cookie provided for Genshin account",
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
				stamina: {
					...account.stamina,
					fired: false
				},
				expedition: {
					...account.expedition,
					fired: false
				},
				cookie: cookieData,
				deviceId: account.cookie.deviceId ?? "",
				deviceFp: account.cookie.deviceFp ?? ""
			});

			const region = app.Utils.formattedAccountRegion(data.region);
			app.Logger.info(this.fullName, `Logged into (${data.game_role_id}) ${data.nickname} (${region})`);
		}
	}

	async checkAndExecute () {
		const accounts = this.accounts;
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
			app.Logger.error(`${this.name}`, {
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
			app.Logger.error(`${this.name}`, {
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
			app.Logger.error(this.fullName, {
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
			app.Logger.error(this.fullName, {
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
			app.Logger.error(this.fullName, {
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
			app.Logger.error(this.fullName, {
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

	async redeemCode (accountData, code) {
		const timeout = Math.random() * 3 + 7;
		await new Promise(resolve => setTimeout(resolve, timeout * 1000));

		const res = await app.Got({
			url: this.config.url.redemption,
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				uid: accountData.uid,
				region: accountData.region,
				lang: "en",
				cdkey: code,
				game_biz: "hk4e_global",
				sLangKey: "en-us"
			},
			headers: {
				Cookie: accountData.cookie
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.error(`${this.fullName}:RedeemCode`, {
				message: "Request threw non-200 status code",
				args: {
					code,
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.error(`${this.fullName}:RedeemCode`, {
				message: "Failed to redeem code",
				args: {
					code,
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false,
				message: res.body.message
			};
		}

		app.Logger.info(`${this.fullName}:RedeemCode`, `(${accountData.uid}) ${accountData.nickname} redeemed code: ${code}`);

		return {
			success: true,
			message: "Code redeemed successfully!"
		};
	}

	async notes (accountData) {
		const cachedData = this.dataCache.get(accountData.uid);
		if (cachedData) {
			return {
				success: true,
				data: {
					...cachedData,
					assets: {
						...this.config.assets,
						logo: this.#logo,
						color: this.#color
					}
				}
			};
		}

		const res = await app.Got({
			url: this.config.url.notes,
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				server: accountData.region,
				role_id: accountData.uid
			},
			headers: {
				"x-rpc-device_id": accountData.deviceId,
				"x-rpc-device_fp": accountData.deviceFp,
				Cookie: accountData.cookie,
				DS: app.Utils.generateDS()
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.error(`${this.fullName}:Notes`, {
				message: "Failed to fetch data from hoyolab",
				args: {
					platform: this.name,
					uid: accountData.uid,
					region: accountData.region,
					body: res.body
				}
			});

			return { success: false };
		}
		if (res.body.retcode !== 0) {
			app.Logger.error(`${this.fullName}:Notes`, {
				message: "HoyoLab returned non-zero retcode",
				args: {
					platform: this.name,
					uid: accountData.uid,
					region: accountData.region,
					body: res.body
				}
			});

			return { success: false };
		}

		const data = res.body.data;
		
		const stamina = {
			currentStamina: data.current_resin,
			maxStamina: data.max_resin,
			recoveryTime: data.resin_recovery_time
		};

		const dailies = {
			task: data.finished_task_num,
			maxTask: data.total_task_num
		};

		const weeklies = {
			resinDiscount: data.remain_resin_discount_num,
			resinDiscountLimit: data.resin_discount_num_limit
		};

		this.dataCache.set(accountData.uid, {
			uid: accountData.uid,
			nickname: accountData.nickname,
			lastUpdated: Date.now(),
			stamina,
			dailies,
			weeklies,
			expedition: {
				completed: data.expeditions.every(i => i.status.toLowerCase() === "finished"),
				list: data.expeditions
			}
		});

		return {
			success: true,
			data: {
				stamina,
				dailies,
				weeklies,
				expedition: {
					completed: data.expeditions.every(i => i.status.toLowerCase() === "finished"),
					list: data.expeditions
				},
				assets: {
					...this.config.assets,
					logo: this.#logo,
					color: this.#color
				}
			}
		};
	}

	get logo () { return this.#logo; }
	get color () { return this.#color; }
};
