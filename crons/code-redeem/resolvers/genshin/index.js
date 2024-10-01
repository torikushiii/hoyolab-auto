const Defaults = require("./defaults");
const HoyoLab = require("./hoyolab");

const fetchAll = async () => {
	try {
		const [defaults, hoyolab] = await Promise.all([
			Defaults.fetch(),
			HoyoLab.fetch()
		]);

		const cachedCodes = await app.Cache.get("genshin-code") || [];
		const codes = new Set(cachedCodes.map(i => i.code));

		const data = [...defaults, ...hoyolab]
			.filter(i => i && typeof i.code === "string" && i.code.trim() !== "")
			.filter(i => Array.isArray(i.rewards) && i.rewards.length > 0)
			.filter((i, index, self) => self.findIndex(t => t.code === i.code) === index);

		app.Logger.debug("GenshinResolver", `Fetched ${data.length} codes`);

		if (cachedCodes.length === 0) {
			app.Logger.warn("GenshinResolver", "No cached codes found, caching all codes");
			const newCodes = data.map(i => ({
				...i,
				date: Date.now(),
				active: false
			}));
			await app.Cache.set({
				key: "genshin-code",
				value: newCodes
			});

			return newCodes;
		}

		const filteredData = data.filter(i => !codes.has(i.code));
		if (filteredData.length === 0) {
			app.Logger.debug("GenshinResolver", "No new codes found");
			return [];
		}

		app.Logger.info("GenshinResolver", `Found ${filteredData.length} new code(s)`);

		const newCodes = filteredData.map(i => ({ ...i, date: Date.now(), active: false }));
		await app.Cache.set({
			key: "genshin-code",
			value: [
				...cachedCodes,
				...newCodes
			]
		});

		console.log("Genshin - New codes found:", newCodes.map(code => code.code).join(", "));
		return newCodes;
	}
	catch (e) {
		app.Logger.error("GenshinResolver", "Error fetching codes", e);
		return [];
	}
};

module.exports = {
	fetchAll
};
