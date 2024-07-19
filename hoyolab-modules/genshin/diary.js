const { setTimeout } = require("node:timers/promises");

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

		const [primoPromises, moraPromises] = await Promise.allSettled([
			this.fetchResultsForType(accountData, 1),
			this.fetchResultsForType(accountData, 2)
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

	async fetchResultsForType (accountData, type) {
		const currentMonth = new Date().getMonth() + 1;
		const lastMonth = (currentMonth === 1) ? 12 : currentMonth - 1;

		const fetchMonthData = async (month) => {
			const searchParams = {
				lang: "en-us",
				uid: accountData.uid,
				region: accountData.region,
				month,
				type,
				current_page: 1,
				page_size: 100,
				total: 0
			};

			let allResults = [];
			let currentPage = 1;
			let totalResults = 0;

			do {
				searchParams.current_page = currentPage;

				const res = await app.Got("HoyoClient", {
					url: this.#instance.config.url.diary,
					responseType: "json",
					searchParams,
					headers: {
						Cookie: accountData.cookie,
						DS: app.Utils.generateDS()
					}
				});

				if (res.body.retcode !== 0) {
					app.Logger.log(`${this.#instance.fullName}:Diary`, {
						message: "Failed to fetch diary data",
						args: {
							platform: this.#instance.name,
							uid: accountData.uid,
							region: accountData.region,
							body: res.body
						}
					});

					break;
				}

				await setTimeout(7500);

				const data = res.body.data;
				allResults = allResults.concat(data.list);
				totalResults = data.total;
				currentPage++;
			} while (allResults.length < totalResults);

			return allResults;
		};

		// Fetch data for current and last months
		const currentMonthResults = await fetchMonthData(currentMonth);
		const lastMonthResults = await fetchMonthData(lastMonth);

		return { currentMonthResults, lastMonthResults };
	}
};
