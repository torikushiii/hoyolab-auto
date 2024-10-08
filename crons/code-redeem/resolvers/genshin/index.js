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

		let newCodes = [];

		if (cachedCodes.length === 0) {
			app.Logger.warn("GenshinResolver", "No cached codes found, caching all codes");
			newCodes = data.map(i => ({
				...i,
				date: Date.now()
			}));
		}
		else {
			newCodes = data.filter(i => !codes.has(i.code)).map(i => ({
				...i,
				date: Date.now()
			}));
		}

		if (newCodes.length > 0) {
			app.Logger.info("GenshinResolver", `Found ${newCodes.length} new code(s)`);
			console.log("Genshin - New codes found:", newCodes.map(code => code.code).join(", "));

			const updatedCachedCodes = [...cachedCodes, ...newCodes];
			await app.Cache.set({
				key: "genshin-code",
				value: updatedCachedCodes
			});
		}
		else {
			app.Logger.debug("GenshinResolver", "No new codes found");
		}

		return newCodes;
	}
	catch (e) {
		app.Logger.error("GenshinResolver", "Error fetching codes", e);
		return [];
	}
};

const redeem = async (account, code, cookieData) => app.Got("HoYoLab", {
	url: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
	searchParams: {
		uid: account.uid,
		region: account.region,
		lang: "en",
		cdkey: code.code,
		game_biz: "hk4e_global",
		sLangKey: "en-us"
	},
	headers: {
		Cookie: cookieData
	}
});

module.exports = {
	fetchAll,
	redeem
};
