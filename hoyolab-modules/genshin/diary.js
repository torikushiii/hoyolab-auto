const { setTimeout } = require("node:timers/promises");

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

		const currentMonth = new Date().getMonth() + 1;
		const lastMonth = (currentMonth === 1) ? 12 : currentMonth - 1;

		const [primoPromises, moraPromises] = await Promise.allSettled([
			this.fetchResultsForType(accountData, 1, { currentMonth, lastMonth }),
			this.fetchResultsForType(accountData, 2, { currentMonth, lastMonth })
		]);

		if (primoPromises.status === "rejected" || moraPromises.status === "rejected") {
			app.Logger.log(`${this.#instance.fullName}:Diary`, {
				message: "Failed to fetch diary data",
				args: {
					platform: this.#instance.name,
					uid: accountData.uid,
					region: accountData.region,
					primoData: primoPromises.reason,
					moraData: moraPromises.reason
				}
			});

			return { success: false };
		}

		const primoData = primoPromises.value;
		const moraData = moraPromises.value;

		const calculateTotalsAndPercentages = (data) => {
			const totalNum = data.reduce((acc, curr) => acc + curr.num, 0);

			const actionCounts = data.reduce((acc, curr) => {
				let category;

				const action = curr.action.toLowerCase();
				switch (true) {
					case action.includes("daily commission"):
						category = "Daily Commission";
						break;
					case action.includes("event"):
						category = "Event";
						break;
					case action.includes("spiral abyss"):
						category = "Spiral Abyss";
						break;
					case action.includes("mail"):
						category = "Mail";
						break;
					default:
						category = "Other";
						break;
				}

				if (!acc[category]) {
					acc[category] = { total: 0, count: 0 };
				}
				acc[category].total += curr.num;
				acc[category].count += 1;
				return acc;
			}, {});

			const actionPercentages = Object.keys(actionCounts).map(category => ({
				category,
				total: actionCounts[category].total,
				percentage: ((actionCounts[category].total / totalNum) * 100).toFixed(0)
			}));

			actionPercentages.sort((a, b) => b.total - a.total);
			return { totalNum, actionPercentages };
		};

		const calculateTotalNum = (data) => data.reduce((acc, curr) => acc + curr.num, 0);

		const currentMonthPrimo = calculateTotalsAndPercentages(primoData.currentMonthResults);
		const currentMonthMora = calculateTotalNum(moraData.currentMonthResults);

		const lastMonthPrimo = calculateTotalsAndPercentages(primoData.lastMonthResults);
		const lastMonthPass = calculateTotalNum(moraData.lastMonthResults);

		const primoIncomeDecreasePercentage = (((lastMonthPrimo.totalNum - currentMonthPrimo.totalNum) / lastMonthPrimo.totalNum) * 100).toFixed(0);

		const diaryData = {
			currentMonth: {
				primo: currentMonthPrimo,
				mora: currentMonthMora
			},
			lastMonth: {
				primo: lastMonthPrimo,
				mora: lastMonthPass
			},
			primoIncomeDecreasePercentage
		};

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

	async fetchResultsForType (accountData, type, options = {}) {
		const fetchPage = async (type, month, currentPage) => {
			const response = await app.Got("HoyoClient", {
				url: this.#instance.config.url.diary,
				responseType: "json",
				searchParams: {
					uid: accountData.uid,
					region: accountData.region,
					month,
					current_page: currentPage,
					type,
					lang: "en-us"
				},
				headers: {
					Referer: "https://act.hoyolab.com",
					"x-rpc-app_version": "1.5.0",
					"x-rpc-client_type": 5,
					"x-rpc-language": "en-us",
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
					Cookie: accountData.cookie,
					DS: app.Utils.generateDS()
				}
			});

			if (!response.ok) {
				app.Logger.log(`${this.#instance.fullName}:Diary`, {
					message: "Hoyolab API returned non-200 status code",
					args: {
						platform: this.#instance.name,
						uid: accountData.uid,
						response: response.body
					}
				});
			}

			if (response.body.retcode !== 0) {
				app.Logger.log(`${this.#instance.fullName}:Diary`, {
					message: "Hoyolab API returned non-zero retcode",
					args: {
						platform: this.#instance.name,
						uid: accountData.uid,
						response: response.body
					}
				});
			}

			return response.body.data;
		};

		const fetchAllPages = async (type, month) => {
			let currentPage = 1;
			let hasMorePages = true;
			let allData = [];

			while (hasMorePages) {
				const data = await fetchPage(type, month, currentPage);

				if (data && data.list && data.list.length > 0) {
					allData = allData.concat(data.list);
					currentPage++;
				}
				else {
					hasMorePages = false;
				}
			}

			return allData;
		};

		const { currentMonth, lastMonth } = options;

		const currentMonthData = await fetchAllPages(type, currentMonth);
		await setTimeout(10_000);
		const lastMonthData = await fetchAllPages(type, lastMonth);

		return {
			currentMonthResults: currentMonthData,
			lastMonthResults: lastMonthData
		};
	}
};
