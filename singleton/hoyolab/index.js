const CheckIn = require("./check-in.js");
const Expedition = require("./expedition.js");
const Stamina = require("./stamina.js");

module.exports = class HoyoLab {
	static url = {
		genshin: "https://bbs-api-os.mihoyo.com/game_record/genshin/api/dailyNote",
		starrail: "https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/note"
	};

	async checkIn (account, platform) {
		const ci = new CheckIn({ account, platform });
		return await ci.checkAndExecute();
	}

	async expedition (account, platform, options = {}) {
		const ex = new Expedition({ account, platform });
		return ex.checkAndExecute(options);
	}

	async stamina (account, platform, options = {}) {
		const st = new Stamina({ account, platform });
		return st.checkAndExecute(options);
	}

	async getNotes (account, platform, options = {}) {
		const cookieData = app.Account.getAccountCookie(account.id);

		const res = await app.Got({
			url: HoyoLab.url[platform],
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				server: options.region,
				role_id: options.uid
			},
			headers: {
				"x-rpc-app_version": "1.5.0",
				"x-rpc-client_type": 5,
				"x-rpc-language": "en-us",
				cookie: cookieData,
				DS: app.Utils.generateDS()
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.error("HoyoLab:Notes", {
				message: "Failed to fetch data from hoyolab",
				args: {
					platform,
					uid: options?.uid ?? account.id,
					region: options?.region ?? null,
					body: res.body
				}
			});

			return { success: false };
		}
		if (res.body.retcode !== 0) {
			app.Logger.error("HoyoLab:Notes", {
				message: "HoyoLab returned non-zero retcode",
				args: {
					platform,
					uid: options?.uid ?? account.id,
					region: options?.region ?? null,
					body: res.body
				}
			});

			return { success: false };
		}

		if (res.body.retcode !== 0 && res.body.message !== "OK") {
			app.Logger.error("HoyoLab:Notes", {
				message: "HoyoLab returned non-zero retcode",
				args: {
					platform,
					uid: options?.uid ?? account.id,
					region: options?.region ?? null,
					body: res.body
				}
			});

			return { success: false };
		}

		const data = res.body.data;

		const identifier = (platform === "genshin") ? "resin" : "stamina";
		const stamina = {
			currentStamina: data[`current_${identifier}`] ?? null,
			maxStamina: data[`max_${identifier}`] ?? null,
			recoveryTime: data.resin_recovery_time ?? data.stamina_recover_time ?? null,
			reserveStamina: data.current_reserve_stamina ?? null,
			isReserveStaminaFull: data.is_reserve_stamina_full ?? null
		};

		const dailies = {
			totalTasks: data.total_task_num ?? data.current_train_score,
			finishedTasks: data.finished_task_num ?? data.max_train_score
		};

		const weeklies = {
			resinDiscount: data.remain_resin_discount_num ?? null,
			resinDiscountLimit: data.resin_discount_num_limit ?? null,
			weeklyCocoonCount: data.weekly_cocoon_cnt ?? null,
			weeklyCocoonLimit: data.weekly_cocoon_limit ?? null,
			rogueScore: data.current_rogue_score ?? null,
			maxRogueScore: data.max_rogue_score ?? null
		};

		return {
			success: true,
			stamina,
			dailies,
			weeklies,
			expedition: {
				completed: data.expeditions.every(i => i.status.toLowerCase() === "finished"),
				list: data.expeditions
			}
		};
	}
};
