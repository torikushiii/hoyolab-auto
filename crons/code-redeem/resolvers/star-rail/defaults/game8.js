exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://game8.co/games/Honkai-Star-Rail/archives/410296",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		app.Logger.log("StarRail:Game8", {
			message: "Failed to fetch data.",
			statusCode: res.statusCode
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);

	const codes = [];

	const table = $("body > div.l-content > div.l-3col > div.l-3colMain > div.l-3colMain__center.l-3colMain__center--shadow > div.archive-style-wrapper > ul");
	const codeList = table.find(".a-listItem");
	if (codeList.length === 0) {
		app.Logger.debug("StarRail:Game8", {
			message: "No codes found.",
			args: {
				body: res.body
			}
		});
	}

	for (let i = 0; i < codeList.length; i++) {
		const $code = $(codeList[i]);
		const codeText = $code.text().trim();
		const [code, ...rewardParts] = codeText.split(" ");
		const rewardsText = rewardParts.join(" ").replace(code, "").trim();

		const cleanedRewardsText = rewardsText.replace(/^-/, "").trim();
		const rewards = cleanedRewardsText
			.split(/,\s| and /)
			.map((reward) => reward.replace(/\(|\)/g, "").trim());

		codes.push({
			code: code.trim(),
			rewards,
			source: "game8"
		});
	}

	app.Logger.debug("StarRail:Game8", {
		message: `Found ${codes.length} codes.`,
		codes
	});

	return codes;
};
