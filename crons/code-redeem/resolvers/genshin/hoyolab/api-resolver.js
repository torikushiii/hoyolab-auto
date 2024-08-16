const pictureHash = [
	{
		hash: "150a941de99e21fc96dce97cde2dae22_1631694835879620915",
		name: "Primogem"
	},
	{
		hash: "46de1e881b5dff638969aed85850e388_7373589751062039567",
		name: "Hero's Wit"
	},
	{
		hash: "503abf5f2f2c8b2013dde0f2197fc9ac_3214074117670348863",
		name: "Mora"
	},
	{
		hash: "d3eb1267f27bead29907cb279d4365ab_4473305467748929436",
		name: "Mystic Enhancement Ore"
	}
];

exports.fetch = async () => {
	const res = await app.Got("FakeAgent", {
		url: "https://bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material",
		responseType: "json",
		throwHttpErrors: false,
		searchParams: {
			game_id: 2
		},
		headers: {
			"x-rpc-app_version": "2.42.0",
			"x-rpc-client_type": 4
		}
	});

	if (res.statusCode !== 200) {
		app.Logger.log("Genshin:HoyoLabAPI", {
			message: "Failed to fetch data from Hoyolab API.",
			statusCode: res.statusCode,
			response: res.body
		});
		return [];
	}

	const exchangeGroup = res.body.data.modules.find(i => i.exchange_group !== null);
	if (!exchangeGroup) {
		app.Logger.debug("Genshin:HoyoLabAPI", {
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
