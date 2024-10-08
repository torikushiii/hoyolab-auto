const Defaults = require("./defaults");
const HoyoLab = require("./hoyolab");

const fetchAll = async () => {
	try {
		const [defaults, hoyolab] = await Promise.all([
			Defaults.fetch(),
			HoyoLab.fetch()
		]);

		const cachedCodes = await app.Cache.get("zenless-code") || [];
		const codes = new Set(cachedCodes.map(i => i.code));

		const data = [...defaults, ...hoyolab]
			.filter(i => i && typeof i.code === "string" && i.code.trim() !== "")
			.filter(i => Array.isArray(i.rewards) && i.rewards.length > 0)
			.filter((i, index, self) => self.findIndex(t => t.code === i.code) === index);

		app.Logger.debug("ZenlessResolver", `Fetched ${data.length} codes`);

		let newCodes = [];

		if (cachedCodes.length === 0) {
			app.Logger.warn("ZenlessResolver", "No cached codes found, caching all codes");
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
			app.Logger.info("ZenlessResolver", `Found ${newCodes.length} new code(s)`);
			console.log("Zenless - New codes found:", newCodes.map(code => code.code).join(", "));

			const updatedCachedCodes = [...cachedCodes, ...newCodes];
			await app.Cache.set({
				key: "zenless-code",
				value: updatedCachedCodes
			});
		}
		else {
			app.Logger.debug("ZenlessResolver", "No new codes found");
		}

		return newCodes;
	}
	catch (e) {
		app.Logger.error("ZenlessResolver", "Error fetching codes", e);
		return [];
	}
};

const redeem = async (account, code, cookieData) => app.Got("HoYoLab", {
	url: "https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
	searchParams: {
		t: Date.now(),
		lang: "en",
		game_biz: "nap_global",
		uid: account.uid,
		region: account.region,
		cdkey: code.code
	},
	headers: {
		Cookie: cookieData
	}
});

module.exports = {
	fetchAll,
	redeem
};
