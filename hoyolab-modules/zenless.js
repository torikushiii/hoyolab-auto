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

module.exports = class ZenlessZoneZero extends require("./template.js") {
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

	async checkAndExecute () {
		const accounts = this.accounts;
		if (accounts.length === 0) {
			app.Logger.warn("No active accounts found for StarRail");
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
				app.Logger.info(`${this.fullName}:CheckIn`, `${account.nickname} already signed in today`);

				success.push({
					uid: account.uid,
					platform: this.name,
					rank: account.level,
					username: account.nickname,
					region: app.HoyoLab.getRegion(account.region),
					total: data.total,
					result: this.config.signedMessage,
					assets: {
						...this.config.assets,
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

			app.Logger.info(`${this.fullName}:CheckIn`, `(${account.uid}) ${account.nickname} Today's Reward: ${awardObject.name} x${awardObject.count}`);

			success.push({
				uid: account.uid,
				platform: this.name,
				rank: account.level,
				username: account.nickname,
				region: app.HoyoLab.getRegion(account.region),
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
		const res = await app.Got("MiHoYo", {
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
			app.Logger.log(`${this.fullName}`, {
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
			app.Logger.log(`${this.fullName}`, {
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
		const res = await app.Got("MiHoYo", {
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
			app.Logger.log(`${this.fullName}`, {
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
			app.Logger.log(`${this.fullName}`, {
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
		const res = await app.Got("MiHoYo", {
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
			app.Logger.log(`${this.fullName}`, {
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
			app.Logger.log(`${this.fullName}`, {
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
		const cookieData = app.HoyoLab.parseCookie(accountData.cookie, {
			whitelist: [
				"cookie_token_v2",
				"account_mid_v2",
				"account_id_v2"
			]
		});

		const res = await app.Got("MiHoYo", {
			url: this.config.url.redemption,
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				t: Date.now(),
				lang: "en",
				game_biz: "nap_global",
				uid: accountData.uid,
				region: accountData.region,
				cdkey: code
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.fullName}:RedeemCode`, {
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
			app.Logger.log(`${this.fullName}:RedeemCode`, {
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
			success: true
		};
	}

	async notes (accountData) {
		const cachedData = await this.dataCache.get(accountData.uid);
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

		const cookieData = app.HoyoLab.parseCookie(accountData.cookie, {
			whitelist: [
				"ltoken_v2",
				"ltmid_v2",
				"ltuid_v2"
			]
		});

		const res = await app.Got("MiHoYo", {
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
				Cookie: cookieData,
				DS: app.Utils.generateDS()
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.fullName}:Notes`, {
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
			app.Logger.log(`${this.fullName}:Notes`, {
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

		// Howl daily scratch card.
		const cardSign = (data.card_sign === "CardSignDone") ? "Completed" : "Not Completed";
		const stamina = {
			currentStamina: data.energy.progress.current,
			maxStamina: data.energy.progress.max,
			recoveryTime: data.energy.restore
		};

		const dailies = {
			task: data.vitality.current,
			maxTask: data.vitality.max
		};

		const ShopState = {
			SaleStateNo: "Closed",
			SaleStateDoing: "Open",
			SaleStateDone: "Finished"
		};

		const shop = {
			state: ShopState[data.vhs_sale.sale_state]
		};

		await this.dataCache.set(accountData.uid, {
			uid: accountData.uid,
			nickname: accountData.nickname,
			lastUpdate: Date.now(),
			cardSign,
			stamina,
			dailies,
			shop
		});

		return {
			success: true,
			data: {
				cardSign,
				stamina,
				dailies,
				shop,
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
