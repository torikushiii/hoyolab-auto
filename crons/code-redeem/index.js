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
	description: "Check and redeem codes for supported games from HoyoLab.",
	code: async function codeRedeem () {
		try {
			const accountData = app.HoyoLab.getActiveAccounts({
				blacklist: ["honkai", "tot"]
			});

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

			await Promise.all([
				processCodesForGame("genshin", genshin, redeemGenshin, telegram, webhook),
				processCodesForGame("starrail", starrail, redeemStarRail, telegram, webhook),
				processCodesForGame("nap", zenless, redeemZenless, telegram, webhook)
			]);
		}
		catch (e) {
			app.Logger.error("CodeRedeem", "An error occurred during code redemption process", e);
		}
	}
};

async function processCodesForGame (gameName, codes, redeemFunction, telegram, webhook) {
	if (codes.length === 0) {
		return;
	}

	const accounts = app.HoyoLab.getActiveAccounts({ whitelist: gameName });
	if (accounts.length === 0) {
		app.Logger.debug("CodeRedeem", `No active accounts found for ${gameName}.`);
		return;
	}

	for (const account of accounts) {
		if (account.redeemCode === false) {
			continue;
		}

		try {
			const { success, failed } = await redeemFunction(account, codes);

			for (const code of [...success, ...failed]) {
				await sendNotification(success.includes(code), account, code, telegram, webhook);
			}
		}
		catch (e) {
			app.Logger.error("CodeRedeem", `Error processing codes for ${gameName}`, e);
		}
	}
}

async function sendNotification (isSuccess, account, code, telegram, webhook) {
	const message = buildMessage(isSuccess, account, code);

	try {
		if (webhook) {
			await webhook.send(message.embed);
		}
		if (telegram) {
			const escapedMessage = app.Utils.escapeCharacters(message.telegram);
			await telegram.send(escapedMessage);
		}
	}
	catch (e) {
		app.Logger.error("CodeRedeem", "Error sending notification", e);
	}
}
