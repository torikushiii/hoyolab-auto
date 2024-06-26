const pictureHash = [
	{
		hash: "77cb5426637574ba524ac458fa963da0_6409817950389238658",
		name: "Stellar Jade"
	},
	{
		hash: "7cb0e487e051f177d3f41de8d4bbc521_2556290033227986328",
		name: "Refined Aether"
	},
	{
		hash: "508229a94e4fa459651f64c1cd02687a_6307505132287490837",
		name: "Traveler's Guide"
	},
	{
		hash: "0b12bdf76fa4abc6b4d1fdfc0fb4d6f5_4521150989210768295",
		name: "Credit"
	}
];

exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material",
		responseType: "json",
		throwHttpErrors: false,
		searchParams: {
			game_id: 6
		},
		headers: {
			"x-rpc-app_version": "2.42.0",
			"x-rpc-client_type": 4
		}
	});

	if (res.statusCode !== 200) {
		app.Logger.log("HoyoLabAPI", {
			message: "Failed to fetch data from Hoyolab API.",
			statusCode: res.statusCode,
			response: res.body
		});
		return [];
	}

	const exchangeGroup = res.body.data.modules.find(i => i.exchange_group !== null);
	if (!exchangeGroup) {
		app.Logger.debug("HoyoLabAPI", {
			message: "No exchange group found.",
			body: res.body
		});
		return [];
	}

	const pendingCodes = [];
	const bonuses = (exchangeGroup && exchangeGroup.exchange_group && exchangeGroup.exchange_group.bonuses) ?? [];
	if (bonuses.length !== 0) {
		const availableCodes = bonuses.filter(i => i.code_status === "ON");
		for (const code of availableCodes) {
			const rewards = code.icon_bonuses.map(i => ({
				code: i.bonus_num,
				reward: `${i.bonus_num} ${pictureHash.find(j => i.icon_url.includes(j.hash))?.name}` ?? "Unknown"
			}));

			pendingCodes.push({ code: code.exchange_code, rewards: rewards.map(i => `x${i.reward}`) });
		}
	}

	return pendingCodes;
};
