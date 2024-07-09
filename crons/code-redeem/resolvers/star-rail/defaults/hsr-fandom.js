exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://honkai-star-rail.fandom.com/wiki/Redemption_Code",
		responseType: "text",
		throwHttpErrors: false
	});

	if (res.statusCode !== 200) {
		app.Logger.log("HSRFandom", {
			message: "Failed to fetch data from HSR Fandom.",
			statusCode: res.statusCode
		});

		return [];
	}

	const $ = app.Utils.cheerio(res.body);

	const table = $("#mw-content-text > div.mw-parser-output > table > tbody").toArray().map(i => $(i).text());
	const tableList = table[0].split("\n").filter(Boolean);

	const rewards = [];
	for (const row of tableList) {
		if (row.includes("China")) {
			continue;
		}

		const cleanText = row.replace(/All|(\[\d+\]|Quick Redeem)|CodeServerRewardsDuration/g, "").trim();
		const codeRegex = /HSRGRANDOPEN[0-9]|[A-Z0-9]{12,15}/;
		const code = cleanText.match(codeRegex)?.[0];
		if (!code) {
			continue;
		}

		const reward = cleanText.replace(codeRegex, "").trim().split("Discovered")[0];
		const rewardList = reward.split(/×\d+/g).filter(Boolean).map(i => i.trim());
		const rewardAmount = reward.match(/×\d+/g).map(i => i.replace("×", "").trim());

		const joined = [];
		for (let i = 0; i < rewardList.length; i++) {
			joined.push(`${rewardList[i]} x${rewardAmount[i]}`);
		}

		rewards.push({
			code,
			rewards: joined,
			source: "star-rail-fandom"
		});
	}

	app.Logger.debug("HSRFandom", {
		message: `Found ${rewards.length} rewards.`,
		rewards
	});

	return rewards;
};
