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
						cause: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode),
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

		const stamina = {
			currentStamina: data.current_resin,
			maxStamina: data.max_resin,
			recoveryTime: data.resin_recovery_time
		};

		const { daily_task } = data;
		const dailies = {
			task: daily_task.finished_num,
			maxTask: daily_task.total_num,
			storedAttendance: daily_task.stored_attendance,
			storedAttendanceRefresh: daily_task.stored_attendance_refresh_countdown
		};

		const weeklies = {
			resinDiscount: data.remain_resin_discount_num,
			resinDiscountLimit: data.resin_discount_num_limit
		};

		const realm = {
			currentCoin: data.current_home_coin,
			maxCoin: data.max_home_coin,
			recoveryTime: data.home_coin_recovery_time
		};

		this.#instance.dataCache.set(accountData.uid, {
			uid: accountData.uid,
			nickname: accountData.nickname,
			lastUpdated: app.Date.now(),
			expires: app.Date.now(),
			stamina,
			dailies,
			weeklies,
			realm,
			expedition: {
				completed: data.expeditions.every(i => i.status.toLowerCase() === "finished"),
				list: data.expeditions.map(i => ({
					avatar: i.avatar_side_icon,
					status: i.status,
					remaining_time: i.remained_time
				}))
			}
		});

		return {
			success: true,
			data: {
				stamina,
				dailies,
				weeklies,
				realm,
				expedition: {
					completed: data.expeditions.every(i => i.status.toLowerCase() === "finished"),
					list: data.expeditions.map(i => ({
						avatar: i.avatar_side_icon,
						status: i.status,
						remaining_time: i.remained_time
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
