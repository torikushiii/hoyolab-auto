const {
	fetchCodes,
	redeemGenshin,
	redeemStarRail,
	redeemZenless,
	buildMessage
} = require("./util.js");

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

		const codeData = await fetchCodes(accountData);
		if (!codeData) {
			app.Logger.debug("CodeRedeem", "No codes found.");
			return;
		}

		const telegram = app.Platform.get(2);
		const webhook = app.Platform.get(3);

		const { genshin, starrail, zenless } = codeData;
		if (genshin.length !== 0) {
			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "genshin" });
			if (accounts.length === 0) {
				app.Logger.debug("CodeRedeem", "No active accounts found for Genshin Impact.");
				return;
			}

			for (const account of accounts) {
				if (account.redeemCode === false) {
					continue;
				}

				const { success, failed } = await redeemGenshin(account, genshin);
				if (success.length !== 0) {
					for (const code of success) {
						const message = buildMessage(true, account, code);
						if (webhook) {
							await webhook.send(message.embed);
						}
						if (telegram) {
							const escapedMessage = app.Utils.escapeCharacters(message.telegram);
							await telegram.send(escapedMessage);
						}
					}
				}

				if (failed.length !== 0) {
					for (const code of failed) {
						const message = buildMessage(false, account, code);
						if (webhook) {
							await webhook.send(message.embed);
						}
						if (telegram) {
							const escapedMessage = app.Utils.escapeCharacters(message.telegram);
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

			for (const account of accounts) {
				if (account.redeemCode === false) {
					continue;
				}

				const { success, failed } = await redeemStarRail(account, starrail);
				if (success.length !== 0) {
					for (const code of success) {
						const message = buildMessage(true, account, code);
						if (webhook) {
							await webhook.send(message.embed);
						}
						if (telegram) {
							const escapedMessage = app.Utils.escapeCharacters(message.telegram);
							await telegram.send(escapedMessage);
						}
					}
				}

				if (failed.length !== 0) {
					for (const code of failed) {
						const message = buildMessage(false, account, code);
						if (webhook) {
							await webhook.send(message.embed);
						}
						if (telegram) {
							const escapedMessage = app.Utils.escapeCharacters(message.telegram);
							await telegram.send(escapedMessage);
						}
					}
				}
			}
		}

		if (zenless.length !== 0) {
			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "nap" });
			if (accounts.length === 0) {
				app.Logger.debug("CodeRedeem", "No active accounts found for Zenless Zone Zero.");
				return;
			}

			for (const account of accounts) {
				if (account.redeemCode === false) {
					continue;
				}

				const { success, failed } = await redeemZenless(account, zenless);
				if (success.length !== 0) {
					for (const code of success) {
						const message = buildMessage(true, account, code);
						if (webhook) {
							await webhook.send(message.embed);
						}
						if (telegram) {
							const escapedMessage = app.Utils.escapeCharacters(message.telegram);
							await telegram.send(escapedMessage);
						}
					}
				}

				if (failed.length !== 0) {
					for (const code of failed) {
						const message = buildMessage(false, account, code);
						if (webhook) {
							await webhook.send(message.embed);
						}
						if (telegram) {
							const escapedMessage = app.Utils.escapeCharacters(message.telegram);
							await telegram.send(escapedMessage);
						}
					}
				}
			}
		}
	})
};
