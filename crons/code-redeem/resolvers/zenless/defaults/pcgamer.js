exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://www.pcgamer.com/games/action/zenless-zone-zero-codes/",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		app.Logger.log("PCGamer", {
			message: "Failed to fetch data from PCGamer.",
			statusCode: res.statusCode,
			response: res.body
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);
	const list = $("#article-body > ul:nth-child(10)").children();

	const numberWords = {
		one: 1,
		two: 2,
		three: 3,
		four: 4,
		five: 5
	};

	const rewards = [];
	for (let i = 0; i < list.length; i++) {
		const text = list.eq(i).text();
		const [codePart, rewardsPart] = text.split(" - ");
		const code = codePart.split(" or ")[0]; // Take the first code in case there are multiple codes separated by "or"

		// Replace word numbers with actual numbers (idk why they did this but ok)
		let formattedRewardsPart = rewardsPart.replace(/\s*\(NEW\)/gi, "");
		for (const [word, num] of Object.entries(numberWords)) {
			const regex = new RegExp(`\\b${word}\\b`, "gi");
			formattedRewardsPart = formattedRewardsPart.replace(regex, num);
		}

		// Split rewards and filter out unwanted parts
		const rewards = formattedRewardsPart.split(/,\s+|\s+and\s+/);

		rewards.push({
			code,
			rewards: rewards.map((reward) => reward.replace(/^and\s+/, "").trim()),
			source: "pcgamer"
		});
	}

	app.Logger.debug("PCGamer", {
		message: `Found ${rewards.length} rewards.`,
		rewards
	});

	return rewards;
};
