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

		const res = await app.Got("MiHoYo", {
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
					cause: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode),
					platform: this.#instance.name,
					uid: accountData.uid,
					region: accountData.region,
					body: res.body
				}
			});

			return { success: false };
		}

		const data = res.body.data;

		const stamina = {
			currentStamina: data.current_stamina,
			maxStamina: data.max_stamina,
			recoveryTime: data.stamina_recover_time,
			reserveStamina: data.current_reserve_stamina,
			isReserveStaminaFull: data.is_reserve_stamina_full
		};

		const dailies = {
			task: data.current_train_score,
			maxTask: data.max_train_score
		};

		const weeklies = {
			weeklyBoss: data.weekly_cocoon_cnt,
			weeklyBossLimit: data.weekly_cocoon_limit,
			rogueScore: data.current_rogue_score,
			maxScore: data.max_rogue_score,
			tournScore: data.rogue_tourn_weekly_cur,
			tournMaxScore: data.rogue_tourn_weekly_max,
			tournUnlocked: data.rogue_tourn_weekly_unlocked
		};

		await this.#instance.dataCache.set(accountData.uid, {
			uid: accountData.uid,
			nickname: accountData.nickname,
			lastUpdate: Date.now(),
			stamina,
			dailies,
			weeklies,
			expedition: {
				completed: data.expeditions.every(i => i.status.toLowerCase() === "finished"),
				list: data.expeditions.map(i => ({
					avatar: i.avatars,
					status: i.status,
					remaining_time: i.remaining_time
				}))
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
					list: data.expeditions.map(i => ({
						avatar: i.avatars,
						status: i.status,
						remaining_time: i.remaining_time
					}))
				},
				assets: {
					...this.#instance.config.assets,
					logo: this.#logo,
					color: this.#color
				}
			}
		};
	}
};
