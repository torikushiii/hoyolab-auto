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

		const { threshold } = accountData.stamina;
		if (cachedData && cachedData.stamina.currentStamina < threshold) {
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
			if (res.body.retcode !== -501000) {
				app.Logger.log(`${this.#instance.fullName}:Notes`, {
					message: "HoyoLab returned non-zero retcode",
					args: {
						platform: this.#instance.name,
						uid: accountData.uid,
						region: accountData.region,
						body: res.body
					}
				});
			}

			return { success: false };
		}

		const data = res.body.data;
		if (!data) {
			return { success: false, error: "No data received from API" };
		}

		// Howl daily scratch card.
		const cardSign = (data.card_sign && data.card_sign === "CardSignDone") ? "Completed" : "Not Completed";

		const stamina = data.energy
			? { currentStamina: data.energy.progress?.current ?? 0, maxStamina: data.energy.progress?.max ?? 0, recoveryTime: data.energy.restore ?? 0 }
			: null;

		const dailies = data.vitality
			? { task: data.vitality.current ?? 0, maxTask: data.vitality.max ?? 0 }
			: null;

		const weeklies = {
			bounty: data.bounty_commission?.num ?? 0,
			bountyTotal: data.bounty_commission?.total ?? 0,
			surveyPoints: data.survey_points?.num ?? 0,
			surveyPointsTotal: data.survey_points?.total ?? 0
		};

		const ShopState = {
			SaleStateNo: "Closed",
			SaleStateDoing: "Open",
			SaleStateDone: "Finished"
		};

		const shop = data.vhs_sale ? { state: ShopState[data.vhs_sale.sale_state] ?? "Unknown" } : null;

		if (!stamina || !dailies || !weeklies) {
			app.Logger.warn(`${this.#instance.fullName}:Notes`, {
				message: "No necessary data was received from hoyolab",
				args: {
					platform: this.#instance.name,
					uid: accountData.uid,
					region: accountData.region,
					body: res.body
				}
			});

			return { success: false };
		}

		await this.#instance.dataCache.set(accountData.uid, {
			uid: accountData.uid,
			nickname: accountData.nickname,
			lastUpdate: app.Date.now(),
			expires: app.Date.now(),
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
				weeklies,
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
