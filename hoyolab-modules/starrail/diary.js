const { setTimeout: sleep } = require("node:timers/promises");

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

		const [jadesPromise, passPromises] = await Promise.allSettled([
			this.fetchResultsForType(accountData, 1),
			this.fetchResultsForType(accountData, 2)
		]);

		if (jadesPromise.status === "rejected" || passPromises.status === "rejected") {
			app.Logger.log(`${this.#instance.fullName}:Diary`, {
				message: "Failed to fetch diary data",
				args: {
					platform: this.#instance.name,
					uid: accountData.uid,
					region: accountData.region,
					jadesData: jadesPromise.reason,
					passData: passPromises.reason
				}
			});

			return { success: false };
		}

		const jadesData = jadesPromise.value;
		const passData = passPromises.value;

		const calculateTotalsAndPercentages = (data) => {
			const totalNum = data.reduce((acc, curr) => acc + curr.num, 0);

			const actionCounts = data.reduce((acc, curr) => {
				let category;
				switch (true) {
					case curr.action.includes("day_active_reward"):
					case curr.action.includes("day_train_depot"):
						category = "Daily Activity";
						break;
					// case curr.action.startsWith("v2024"):
					// 	category = "Events";
					// 	break;
					case curr.action.includes("universe_point"):
						category = "Simulated Universe";
						break;
					case curr.action.includes("wangquezhiting"):
						category = "Pure Fiction";
						break;
					case curr.action === "mail_reward":
						category = "Mail";
						break;
					default:
						category = "Others";
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

		const currentMonthJades = calculateTotalsAndPercentages(jadesData.currentMonthResults);
		const currentMonthPass = calculateTotalNum(passData.currentMonthResults);

		const lastMonthJades = calculateTotalsAndPercentages(jadesData.lastMonthResults);
		const lastMonthPass = calculateTotalNum(passData.lastMonthResults);

		const jadeIncomeDecreasePercentage = (((lastMonthJades.totalNum - currentMonthJades.totalNum) / lastMonthJades.totalNum) * 100).toFixed(0);

		const diaryData = {
			currentMonth: {
				jades: currentMonthJades,
				pass: currentMonthPass
			},
			lastMonth: {
				jades: lastMonthJades,
				pass: lastMonthPass
			},
			jadeIncomeDecreasePercentage
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
		const today = new Date();
		const currentMonth = today.getFullYear() * 100 + (today.getMonth() + 1);
		const lastMonth = today.getFullYear() * 100 + today.getMonth();

		const getMonthString = (month) => month.toString().padStart(6, "0");

		const fetchMonthData = async (month, retryCount = 0) => {
			const maxRetries = 3;
			const retryDelay = 5000;

			const searchParams = {
				lang: "en-us",
				uid: accountData.uid,
				region: accountData.region,
				month: getMonthString(month),
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
					if (res.body.retcode === -500001 && retryCount < maxRetries) {
						app.Logger.debug(`${this.#instance.fullName}:Diary`, `Rate limited, retrying in ${retryDelay / 1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
						await sleep(retryDelay);
						return fetchMonthData(month, retryCount + 1);
					}

					app.Logger.log(`${this.#instance.fullName}:Diary`, {
						message: "Failed to fetch diary data",
						args: {
							cause: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode),
							platform: this.#instance.name,
							uid: accountData.uid,
							region: accountData.region,
							body: res.body
						}
					});

					break;
				}

				const data = res.body.data;
				allResults = allResults.concat(data.list);
				totalResults = data.total;
				currentPage++;

				if (allResults.length < totalResults) {
					await sleep(500);
				}
			} while (allResults.length < totalResults);

			return allResults;
		};

		const currentMonthResults = await fetchMonthData(currentMonth);
		await sleep(1000);
		const lastMonthResults = await fetchMonthData(lastMonth);

		return { currentMonthResults, lastMonthResults };
	}
};
