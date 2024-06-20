exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://game8.co/games/Honkai-Star-Rail/archives/410296",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		app.Logger.log("Game8", {
			statusCode: res.statusCode,
			body: res.body
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);

	const codes = [];
	const $codes = $(".a-listItem");
	if ($codes.length === 0) {
		app.Logger.json("Game8", { body: res.body });
		app.Logger.error("Game8", "No codes found on the page.");
	}

	for (let i = 0; i < $codes.length; i++) {
		const $code = $($codes[i]);
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

	app.Logger.json("Game8", {
		message: `Found ${codes.length} codes.`,
		codes
	});

	return codes;
};
