exports.fetch = async () => {
	try {
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
		const title = $("h2:contains(\"Active Redeem Codes for\")").text().trim();

		if (title.includes("Active Redeem Codes for")) {
			const codeList = $("body > div.l-content > div.l-3col > div.l-3colMain > div.l-3colMain__center.l-3colMain__center--shadow > div.archive-style-wrapper > ul.a-list");
			codeList.find("li.a-listItem").each((index, element) => {
				const $element = $(element);
				const codeElement = $element.find("a.a-link").first();
				const code = codeElement.text().trim();

				const rewardsText = $element.text().replace(code, "").replace(/NEW/i, "")
					.trim();
				const rewardsRaw = rewardsText.replace(/^\(|\)$/g, "").split(",");

				const rewards = [];
				let currentReward = "";
				for (const part of rewardsRaw) {
					if (currentReward && /\d+$/.test(currentReward) && /^\d+/.test(part.trim())) {
						// If the current reward ends with a number and the next part starts with a number,
						// it's likely a thousands separator
						currentReward += `,${part.trim()}`;
					}
					else {
						if (currentReward) {
							rewards.push(currentReward.trim());
						}
						currentReward = part.trim();
					}
				}
				if (currentReward) {
					rewards.push(currentReward.trim());
				}

				if (code && rewards.length > 0) {
					codes.push({
						code,
						rewards,
						source: "game8"
					});
				}
			});
		}

		app.Logger.debug("StarRail:Game8", {
			message: `Found ${codes.length} codes.`,
			codes
		});

		return codes;
	}
	catch {
		return [];
	}
};
