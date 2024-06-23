const Defaults = require("./defaults");
const HoyoLab = require("./hoyolab");

const fetchAll = async () => {
	const [defaults, hoyolab] = await Promise.all([
		Defaults.fetch(),
		HoyoLab.fetch()
	]);

	const cachedCodes = await app.Cache.get("genshin-code") || [];
	const codes = new Set(cachedCodes.map(i => i.code));

	const data = [...defaults, ...hoyolab]
		.filter(i => i.code !== "")
		.filter(i => i.rewards.length !== 0)
		.filter((i, index, self) => self.findIndex(t => t.code === i.code) === index)
		.filter(Boolean);

	app.Logger.debug("GenshinResolver", `Fetched ${data.length} codes`);

	if (cachedCodes.length === 0) {
		app.Logger.warn("GenshinResolver", "No cached codes found, caching all codes");
		await app.Cache.set({
			key: "genshin-code",
			value: data.map(i => ({
				...i,
				date: Date.now(),
				active: false
			}))
		});

		return [];
	}

	const filteredData = data.filter(i => !codes.has(i.code));
	if (filteredData.length === 0) {
		app.Logger.debug("GenshinResolver", "No new codes found");
		return [];
	}

	app.Logger.info("GenshinResolver", `Found ${filteredData.length} new codes`);

	const newCodes = filteredData.map(i => ({ ...i, date: Date.now(), active: false }));
	await app.Cache.set({
		key: "genshin-code",
		value: [
			...cachedCodes,
			...newCodes
		]
	});

	return newCodes;
};

module.exports = {
	fetchAll
};
