module.exports = class RealtimeNotes {
	/** @type {import("../template")} */
	#instance;
	#logo;
	#color;

	constructor (instance, options = {}) {
		this.#instance = instance;
		this.#logo = options.logo;
		this.#color = options.color;
	}

	async notes (accountData) {
		const cachedData = await this.#instance.dataCache.get(accountData.uid);
		if (cachedData) {
			return {
				success: true,
				data: {
					...cachedData,
					assets: {
						...this.#instance.config.assets,
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

		const res = await app.Got("HoYoLab", {
			url: this.#instance.config.url.notes,
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				server: accountData.region,
				role_id: accountData.uid
			},
			headers: {
				Cookie: cookieData,
				DS: app.Utils.generateDS()
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.#instance.fullName}:Notes`, {
				message: "Failed to fetch data from hoyolab",
				args: {
					platform: this.#instance.name,
					uid: accountData.uid,
					region: accountData.region,
					body: res.body
				}
			});

			return { success: false };
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:Notes`, {
				message: "HoyoLab returned non-zero retcode",
				args: {
					platform: this.#instance.name,
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

		const weeklies = {
			bounty: data.bounty_commission.num,
			bountyTotal: data.bounty_commission.total,
			surveyPoints: data.survey_points.num,
			surveyPointsTotal: data.survey_points.total
		};

		const ShopState = {
			SaleStateNo: "Closed",
			SaleStateDoing: "Open",
			SaleStateDone: "Finished"
		};

		const shop = {
			state: ShopState[data.vhs_sale.sale_state]
		};

		await this.#instance.dataCache.set(accountData.uid, {
			uid: accountData.uid,
			nickname: accountData.nickname,
			lastUpdate: Date.now(),
			cardSign,
			stamina,
			dailies,
			weeklies,
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
					...this.#instance.config.assets,
					logo: this.#logo,
					color: this.#color
				}
			}
		};
	}
};
