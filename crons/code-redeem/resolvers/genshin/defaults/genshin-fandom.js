exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://genshin-impact.fandom.com/wiki/Promotional_Code",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		console.log("GenshinFandom", {
			message: "Failed to fetch data from Genshin Fandom.",
			statusCode: res.statusCode
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);

	const tableRows = $("#mw-content-text > div > table > tbody > tr").toArray();
	const rewards = [];

	for (const row of tableRows) {
		// eslint-disable-next-line newline-per-chained-call
		const codeElements = $(row).find("td").eq(0).find("a[href*=\"gift?code=\"]");
		const code = codeElements.length > 0 ? codeElements.first().text().trim() : null;
		if (!code) {
			continue;
		}

		const rewardText = $(row).find("td").eq(2)
			.find(".item-text")
			.toArray();

		const rewardsData = rewardText.map((i) => $(i).text().trim());
		console.log(code, rewardsData);
		if (rewardsData.length === 0) {
			continue;
		}

		rewards.push({
			code,
			rewardsData,
			source: "genshin-fandom"
		});
	}

	app.Logger.debug("GenshinFandom", {
		message: `Found ${rewards.length} codes.`,
		rewards
	});

	return rewards;
};
