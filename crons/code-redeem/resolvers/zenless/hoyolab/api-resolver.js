const pictureHash = [
	{
		hash: "cd6682dd2d871dc93dfa28c3f281d527_6175554878133394960",
		name: "Dennies"
	},
	{
		hash: "8609070fe148c0e0e367cda25fdae632_208324374592932270",
		name: "Polychrome"
	},
	{
		hash: "6ef3e419022c871257a936b1857ac9d1_411767156105350865",
		name: "W-Engine Energy Module"
	},
	{
		hash: "86e1f7a5ff283d527bbc019475847174_5751095862610622324",
		name: "Senior Investigator Logs"
	}
];

exports.fetch = async () => {
	try {
		const res = await app.Got("FakeAgent", {
			url: "https://bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				game_id: 8
			},
			headers: {
				"x-rpc-app_version": "2.42.0",
				"x-rpc-client_type": 4
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log("ZenlessZoneZero:HoyoLabAPI", {
				message: "Failed to fetch data from Hoyolab API.",
				statusCode: res.statusCode,
				response: res.body
			});
			return [];
		}

		const exchangeGroup = res.body.data.modules.find(i => i.exchange_group !== null);
		if (!exchangeGroup) {
			app.Logger.debug("ZenlessZoneZero:HoyoLabAPI", {
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
	}
	catch {
		return [];
	}
};
