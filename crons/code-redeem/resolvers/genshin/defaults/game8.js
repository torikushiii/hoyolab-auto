exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://game8.co/games/Genshin-Impact/archives/304759",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		console.log("Game8", {
			message: "Failed to fetch data from Game8.",
			statusCode: res.statusCode
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);
	const elements = $(".archive-style-wrapper > ol > li");

	const data = [];
	for (let i = 0; i < elements.length; i++) {
		const $code = $(elements[i]);
		const code = $code.text().split(" ")[0].trim();
		const rewards = $code.text()
			.split(/\s?- ?\s?/)[1]
			.split(", ")
			.map((reward) => reward.trim());

		data.push({
			code,
			rewards: rewards.flatMap(i => i.split(" and ").map(i => i.trim()))
		});
	}

	app.Logger.debug("Game8", {
		message: `Fetched ${data.length} codes.`,
		data
	});

	return data;
};
