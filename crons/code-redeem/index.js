const CodeResolver = require("./resolvers/index.js");

module.exports = {
	name: "code-redeem",
	expression: "* * * * *",
	description: "Check and redeem codes supported games from HoyoLab.",
	code: (async function codeRedeem () {
		const accountData = app.HoyoLab.getActiveAccounts({ blacklist: "honkai" });
		if (accountData.length === 0) {
			app.Logger.debug("CodeRedeem", "No active accounts found.");
			return;
		}

		const redeemDisabled = accountData.every(i => i.redeemCode === false);
		if (redeemDisabled) {
			app.Logger.debug("CodeRedeem", "Code redeem is disabled for all accounts.");
			return;
		}

		const { starrail, genshin } = await CodeResolver.fetchAll();
		if (starrail.length === 0 && genshin.length === 0) {
			return;
		}

		if (genshin.length !== 0) {
			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "genshin" });
			if (accounts.length === 0) {
				app.Logger.debug("CodeRedeem", "No active accounts found for Genshin Impact.");
				return;
			}

			const telegram = app.Platform.get(2);
			const webhook = app.Platform.get(3);
			for (const account of accounts) {
				if (account.redeemCode === false) {
					continue;
				}

				const { success, failed } = await CodeResolver.redeemGenshin(account, genshin);
				if (success.length !== 0) {
					for (const code of success) {
						const embed = {
							color: 0xBB0BB5,
							title: "Genshin Impact Code Redeem",
							description: `(${account.uid}) ${account.nickname}`
							+ `\nCode Successfully Redeemed!`
							+ `\nCode: \`${code.code}\``
							+ `\nRewards: ${code.rewards.join(", ")}`,
							timestamp: new Date()
						};

						if (webhook) {
							await webhook.send(embed);
						}
						if (telegram) {
							const message = [
								`[Genshin Impact] (${account.uid}) ${account.nickname}`,
								`Code Successfully Redeemed!`,
								`Code: ${code.code}`,
								`Rewards: ${code.rewards.join(", ")}`
							].join("\n");

							const escapedMessage = app.Utils.escapeCharacters(message);
							await telegram.send(escapedMessage);
						}
					}
				}

				if (failed.length !== 0) {
					for (const code of failed) {
						const embed = {
							color: 0xBB0BB5,
							title: "Genshin Impact Code Redeem",
							description: `(${account.uid}) ${account.nickname}`
							+ `\nFailed to redeem code: \`${code.code}\``
							+ `\nManually Redeem Here:\nhttps://genshin.hoyoverse.com/en/gift?code=${code.code}`,
							timestamp: new Date()
						};

						if (webhook) {
							await webhook.send(embed);
						}
						if (telegram) {
							const message = [
								`[Genshin Impact] (${account.uid}) ${account.nickname}`,
								`Code Failed to Redeem!`,
								`Code: ${code.code}`,
								`Manually Redeem Here: https://genshin.hoyoverse.com/en/gift?code=${code.code}`
							].join("\n");

							const escapedMessage = app.Utils.escapeCharacters(message);
							await telegram.send(escapedMessage);
						}
					}
				}
			}
		}

		if (starrail.length !== 0) {
			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "starrail" });
			if (accounts.length === 0) {
				app.Logger.debug("CodeRedeem", "No active accounts found for Star Rail.");
				return;
			}

			const telegram = app.Platform.get(2);
			const webhook = app.Platform.get(3);
			for (const account of accounts) {
				if (account.redeemCode === false) {
					continue;
				}

				const { success, failed } = await CodeResolver.redeemStarRail(account, starrail);
				if (success.length !== 0) {
					for (const code of success) {
						const embed = {
							color: 0xBB0BB5,
							title: "Honkai: Star Rail Code Redeem",
							description: `(${account.uid}) ${account.nickname}`
							+ `\nCode Successfully Redeemed!`
							+ `\nCode: \`${code.code}\``
							+ `\nRewards: ${code.rewards.join(", ")}`,
							timestamp: new Date()
						};

						if (webhook) {
							await webhook.send(embed);
						}
						if (telegram) {
							const message = [
								`[Star Rail] (${account.uid}) ${account.nickname}`,
								`Code Successfully Redeemed!`,
								`Code: ${code.code}`,
								`Rewards: ${code.rewards.join(", ")}`
							].join("\n");

							const escapedMessage = app.Utils.escapeCharacters(message);
							await telegram.send(escapedMessage);
						}
					}
				}

				if (failed.length !== 0) {
					for (const code of failed) {
						const embed = {
							color: 0xBB0BB5,
							title: "Honkai: Star Rail Code Redeem",
							description: `(${account.uid}) ${account.nickname}`
							+ `\nFailed to redeem code: \`${code.code}\``
							+ `\n Manually Redeem Here:\nhttps://hsr.hoyoverse.com/gift?code=${code.code}`,
							timestamp: new Date()
						};

						if (webhook) {
							await webhook.send(embed);
						}
						if (telegram) {
							const message = [
								`[Star Rail] (${account.uid}) ${account.nickname}`,
								`Code Failed to Redeem!`,
								`Code: ${code.code}`,
								`Manually Redeem Here: https://hsr.hoyoverse.com/gift?code=${code.code}`
							].join("\n");

							const escapedMessage = app.Utils.escapeCharacters(message);
							await telegram.send(escapedMessage);
						}
					}
				}
			}
		}
	})
};
