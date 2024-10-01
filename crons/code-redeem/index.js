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
		const accountData = app.HoyoLab.getActiveAccounts({ blacklist: [
			"honkai",
			"tot"
		]});

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
			app.Logger.debug("CodeRedeem", "No new codes found.");
			return;
		}

		const telegram = app.Platform.get(2);
		const webhook = app.Platform.get(3);

		const { genshin, starrail, zenless } = codeData;

		const processCodesForGame = async (gameName, codes, redeemFunction) => {
			if (codes.length === 0) return;

			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: gameName });
			if (accounts.length === 0) {
				app.Logger.debug("CodeRedeem", `No active accounts found for ${gameName}.`);
				return;
			}

			for (const account of accounts) {
				if (account.redeemCode === false) continue;

				const { success, failed } = await redeemFunction(account, codes);

				for (const code of [...success, ...failed]) {
					const message = buildMessage(success.includes(code), account, code);
					if (webhook) {
						await webhook.send(message.embed);
					}
					if (telegram) {
						const escapedMessage = app.Utils.escapeCharacters(message.telegram);
						await telegram.send(escapedMessage);
					}
				}
			}
		};

		await processCodesForGame("genshin", genshin, redeemGenshin);
		await processCodesForGame("starrail", starrail, redeemStarRail);
		await processCodesForGame("nap", zenless, redeemZenless);
	})
};
