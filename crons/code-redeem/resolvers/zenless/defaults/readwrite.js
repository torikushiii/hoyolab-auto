exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://readwrite.com/zenless-zone-zero-codes/",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		app.Logger.log("ZenlessZoneZero:ReadWrite", {
			message: "Failed to fetch data from ReadWrite.",
			statusCode: res.statusCode
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);
	const table = $("div.entry-content > ul").first();

	const rewards = [];
	for (const li of table.children()) {
		const text = $(li).text();

		const [code, rewardsText] = text.split(" – Redeem for ");
		const rewardsData = rewardsText.split(/,\s+|\s+and\s+/).filter(reward => !reward.includes("(Expires"));

		rewards.push({
			code,
			rewards: rewardsData.map(reward => reward.replace("and ", "")),
			source: "readwrite"
		});
	}

	app.Logger.debug("ZenlessZoneZero:ReadWrite", {
		message: `Found ${rewards.length} rewards.`,
		rewards
	});

	return rewards;
};
