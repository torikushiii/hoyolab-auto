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
		const cells = $(row).find("td").toArray();
		const rowData = cells
			.filter((_, index) => index !== 1 && index !== 3)
			.map(cell => $(cell).text().trim());

		if (rowData.length > 0) {
			const codeRegex = /GENSHINGIFT|[A-Z0-9]{12,15}/;
			const code = rowData[0].match(codeRegex)?.[0];

			const reward = rowData[1];
			const rewardList = reward.split(/×\d+/g).filter(Boolean).map(i => i.trim());
			const rewardAmount = reward.match(/×\d+/g).map(i => i.replace("×", "").trim());

			if (code && reward) {
				const joined = [];
				for (let i = 0; i < rewardList.length; i++) {
					joined.push(`${rewardList[i]} x${rewardAmount[i]}`);
				}

				rewards.push({
					code,
					rewards: joined,
					source: "genshin-fandom"
				});
			}
		}
	}

	app.Logger.debug("GenshinFandom", {
		message: `Found ${rewards.length} codes.`,
		rewards
	});

	return rewards;
};
