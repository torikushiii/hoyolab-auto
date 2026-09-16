const { t } = require("../../localization/index.js");
const timers = require("node:timers/promises");
const { getLanguage } = require("../../gots/hoyolab-contexts/language.js");

module.exports = class Diary {
	/** @type {import("../template")} */
	#instance;
	#logo;
	#color;

	constructor (instance, options = {}) {
		this.#instance = instance;
		this.#logo = options.logo;
		this.#color = options.color;
	}

	async diary (accountData) {
		const cachedData = await app.Cache.get(`${this.#instance.name}:${accountData.uid}:diary`);
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

		const today = new Date();
		const year = today.getFullYear();
		const month = today.getMonth() + 1;
		const currentMonth = String(year * 100 + month);
		const lastMonth = String(month === 1 ? (year - 1) * 100 + 12 : year * 100 + month - 1);

		let diaryData;
		try {
			const current = await this.fetchMonth(accountData, currentMonth);
			await timers.setTimeout(1000);
			const previous = await this.fetchMonth(accountData, lastMonth);
			diaryData = {
				currentMonth: current,
				lastMonth: previous,
				jadeIncomeDecreasePercentage: previous.jades.totalNum === 0
					? null
					: (((previous.jades.totalNum - current.jades.totalNum) / previous.jades.totalNum) * 100).toFixed(0)
			};
		}
		catch {
			app.Logger.log(`${this.#instance.fullName}:Diary`, {
				message: t("Failed to fetch diary data"),
				args: { platform: this.#instance.name, uid: accountData.uid, region: accountData.region }
			});
			return { success: false };
		}

		await app.Cache.set({
			key: `${this.#instance.name}:${accountData.uid}:diary`,
			value: diaryData,
			expiry: 7_200_000
		});

		return {
			success: true,
			data: {
				...diaryData,
				assets: {
					...this.#instance.config.assets,
					logo: this.#logo,
					color: this.#color
				}
			}
		};
	}

	async fetchMonth (accountData, month, retryCount = 0) {
		const response = await app.Got("HoYoLabAppWebView", {
			url: this.#instance.config.url.diary,
			responseType: "json",
			searchParams: {
				uid: accountData.uid,
				region: accountData.region,
				month,
				lang: getLanguage()
			},
			headers: { Cookie: accountData.cookie }
		});

		if (!response.ok) {
			throw new Error("Diary HTTP request failed");
		}
		if (response.body?.retcode === -500001 && retryCount < 3) {
			app.Logger.debug(`${this.#instance.fullName}:Diary`, `Rate limited, retrying in 5s... (attempt ${retryCount + 1}/3)`);
			await timers.setTimeout(5000);
			return this.fetchMonth(accountData, month, retryCount + 1);
		}
		if (response.body?.retcode !== 0) {
			throw new Error("Diary API request failed");
		}

		const summary = response.body.data;
		// `month` may still identify the current month in a historical response.
		if (summary?.login_flag !== true || summary.data_month !== month) {
			throw new Error("Invalid Diary month identity or login state");
		}
		const data = summary.month_data;
		const validAmount = value => Number.isFinite(value) && value >= 0;
		if (!data || !validAmount(data.current_hcoin) || !validAmount(data.current_rails_pass)
			|| !Array.isArray(data.group_by)
			|| (data.current_hcoin > 0 && data.group_by.length === 0)
			|| data.group_by.some(item => !item || typeof item.action !== "string" || !item.action.trim()
				|| typeof item.action_name !== "string" || !item.action_name.trim()
				|| !validAmount(item.num) || !validAmount(item.percent))) {
			// Do not turn an unavailable historical breakdown into an empty successful report.
			throw new Error("Invalid Diary monthly summary");
		}

		return {
			jades: {
				totalNum: data.current_hcoin,
				actionPercentages: data.group_by.filter(item => item.num > 0).map(item => ({
					category: item.action_name,
					total: item.num,
					percentage: String(item.percent)
				})).sort((a, b) => b.total - a.total)
			},
			pass: data.current_rails_pass
		};
	}
};
