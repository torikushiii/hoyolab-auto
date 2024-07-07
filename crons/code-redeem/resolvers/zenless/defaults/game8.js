exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://game8.co/games/Zenless-Zone-Zero/archives/435683",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		app.Logger.log("Game8", {
			message: "Failed to fetch data from Game8.",
			statusCode: res.statusCode,
			response: res.body
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);
	const table = $("body > div.l-content > div.l-3col > div.l-3colMain > div.l-3colMain__center.l-3colMain__center--shadow > div.archive-style-wrapper > table:nth-child(8)");

	const data = [];
	for (let i = 1; i < table.find("tr").length; i++) {
		const row = table.find("tr").eq(i);
		// eslint-disable-next-line newline-per-chained-call
		const codePart = row.find("td").eq(1).text().trim();
		const code = codePart.split(" or ")[0];

		const rewardsDivs = row.find("td").eq(2).find("div.align");
		const rewards = [];

		rewardsDivs.each(function () {
			const rewardText = $(this).text().trim();
			rewards.push(rewardText);
		});

		data.push({
			code,
			rewards,
			source: "game8"
		});
	}

	app.Logger.debug("Game8", {
		message: `Found ${data.length} rewards.`,
		data
	});

	return data;
};
