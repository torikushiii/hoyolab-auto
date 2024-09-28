exports.fetch = async () => {
	try {
		const res = await app.Got("FakeAgent", {
			url: "https://game8.co/games/Genshin-Impact/archives/304759",
			responseType: "text",
			throwHttpErrors: false
		});

		if (res.statusCode !== 200) {
			app.Logger.log("Genshin:Game8", {
				message: "Failed to fetch data from Game8.",
				statusCode: res.statusCode
			});

			return [];
		}

		const $ = app.Utils.cheerio(res.body);

		const data = [];

		const extractCodes = (ol) => {
			ol.find("li").each((index, element) => {
				const $code = $(element);
				const codeText = $code.text().trim();
				const [codeWithExpired, rewardsText] = codeText.split(/\s?- ?\s?/);

				const code = codeWithExpired.replace(/\s*\(EXPIRED\)\s*$/, "").trim();
				const rewards = rewardsText
					? rewardsText.replace(/ and /g, ", ").split(", ").map(item => item.trim())
					: [];

				data.push({
					code,
					rewards
				});
			});
		};

		const latestCodesHeader = $("h3.a-header--3:contains(\"Latest Redeem Codes in Version 5.0\")");
		if (latestCodesHeader.length > 0) {
			const latestCodesList = latestCodesHeader.nextAll("ol").first();
			extractCodes(latestCodesList);
		}
		else {
			app.Logger.debug("Genshin:Game8", {
				message: "Could not find 'Latest Redeem Codes in Version 5.0' section."
			});
		}

		const specialProgramHeader = $("h2.a-header--2:contains(\"Special Program Codes\")");
		if (specialProgramHeader.length > 0) {
			const globalExclusiveHeader = specialProgramHeader.nextAll("h4.a-header--4:contains(\"Global-Exclusive Codes\")").first();
			if (globalExclusiveHeader.length > 0) {
				const globalCodesList = globalExclusiveHeader.nextAll("ol").first();
				extractCodes(globalCodesList);
			}
			else {
				app.Logger.debug("Genshin:Game8", {
					message: "Could not find 'Global-Exclusive Codes' section."
				});
			}
		}
		else {
			app.Logger.debug("Genshin:Game8", {
				message: "Could not find 'Special Program Codes' section."
			});
		}

		app.Logger.debug("Genshin:Game8", {
			message: `Fetched ${data.length} codes.`,
			data
		});

		return data;
	}
	catch {
		return [];
	}
};
