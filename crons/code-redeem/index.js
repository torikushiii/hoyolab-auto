const cachedCodes = [];
const { setTimeout } = require("node:timers/promises");

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

module.exports = {
	name: "code-redeem",
	expression: "0 0 * * *",
	description: "Check and redeem codes supported games from HoyoLab.",
	code: (async function codeRedeem () {
		// eslint-disable-next-line object-curly-spacing
		const accounts = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai"] });
		if (!accounts.length === 0) {
			app.Logger.warn("CodeRedeem", "No account available for code redeem.");
			return;
		}

		const disabled = accounts.every(i => i.redeemCode === false);
		if (disabled) {
			app.Logger.warn("CodeRedeem", "Code redeem is disabled for all accounts.");
			return;
		}

		for (const account of accounts) {
			const platform = app.HoyoLab.get(account.platform);
			
			if (account.redeemCode === false) {
				continue;
			}

			const res = await app.Got({
				url: "https://bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material",
				responseType: "json",
				throwHttpErrors: false,
				searchParams: {
					game_id: platform.gameId
				}
			});

			if (res.statusCode !== 200) {
				throw new app.Error({
					message: "Failed to fetch redeemable codes from HoyoLab.",
					args: {
						statusCode: res.statusCode,
						statusMessage: res.body
					}
				});
			}

			const exchangeGroup = res.body.data.modules.find(i => i.exchange_group !== null);
			if (!exchangeGroup) {
				continue;
			}
	
			const pendingCodes = [];
			const bonuses = (exchangeGroup && exchangeGroup.exchange_group && exchangeGroup.exchange_group.bonuses) ?? [];

			if (bonuses.length !== 0) {
				const availableCodes = bonuses.filter(i => i.code_status === "ON");
				for (const code of availableCodes) {
					if (cachedCodes.includes(code.exchange_code)) {
						continue;
					}

					const rewards = code.icon_bonuses.map(i => ({
						code: i.bonus_num,
						rewards: `${i.bonus_num} ${pictureHash.find(j => i.icon_url.includes(j.hash))?.name}` ?? "Unknown"
					}));

					pendingCodes.push({ code: code.exchange_code, rewards: rewards.map(i => `x${i.reward}`) });
				}
			}

			if (pendingCodes.length === 0) {
				continue;
			}

			for (const code of pendingCodes) {
				const res = await app.Got({
					url: platform.config.url.redemption,
					responseType: "json",
					throwHttpErrors: false,
					searchParams: {
						uid: account.uid,
						region: account.region,
						lang: "en",
						cdkey: code.code,
						game_biz: platform.gameBiz
					},
					headers: {
						Cookie: account.cookie
					}
				});

				if (res.statusCode !== 200) {
					throw new app.Error({
						message: "Failed to redeem code.",
						args: {
							statusCode: res.statusCode,
							statusMessage: res.body
						}
					});
				}

				await setTimeout(15_000);

				if (res.body.retcode === -2017) {
					app.Logger.warn("CodeRedeem", `Code ${code.code} has been used.`);
					cachedCodes.push(code.code);
					continue;
				}
				if (res.body.retcode !== 0) {
					const retcode = res.body.retcode;
					throw new app.Error.HoyoLabRequest({ retcode });
				}

				app.Logger.info("CodeRedeem", `Successfully redeemed code ${code.code}. Rewards: ${code.rewards.join(", ")}`);

				cachedCodes.push(code.code);
			}

			const webhook = app.Platform.get(3);
			if (webhook) {
				const embed = {
					color: 0x00FF00,
					title: "Code Redeem",
					description: "Successfully redeemed the following codes:",
					fields: pendingCodes.map(i => ({
						name: i.code,
						value: i.rewards.join(", ")
					})),
					timestamp: new Date()
				};

				await webhook.send(embed);
			}

			const telegram = app.Platform.get(2);
			if (telegram) {
				const messageText = [
					"📢 Code Redeem, Successfully redeemed the following codes:",
					...pendingCodes.map(i => [
						`🎮 **Code**: ${i.code}`,
						`🎁 **Rewards**: ${i.rewards.join(", ")}`
					].join("\n"))
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(messageText);
				await telegram.send(escapedMessage);
			}
		}
	})
};
