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
			app.Logger.info("CodeRedeem", "Starting code redemption process");
			
			const accountData = app.HoyoLab.getActiveAccounts({
				blacklist: ["honkai", "tot"]
			});

			app.Logger.debug("CodeRedeem", `Found ${accountData.length} active accounts`);

			if (accountData.length === 0) {
				app.Logger.debug("CodeRedeem", "No active accounts found.");
				return;
			}

			const redeemDisabled = accountData.every(i => i.redeemCode === false);
			if (redeemDisabled) {
				app.Logger.debug("CodeRedeem", "Code redeem is disabled for all accounts.");
				return;
			}

			app.Logger.debug("CodeRedeem", "Fetching new codes");
			const codeData = await fetchCodes(accountData);
			if (!codeData) {
				app.Logger.debug("CodeRedeem", "No new codes found.");
				return;
			}

			app.Logger.info("CodeRedeem", "New codes found, preparing to redeem");

			const telegram = app.Platform.get(2);
			const webhook = app.Platform.get(3);

			const { genshin, starrail, zenless } = codeData;

			app.Logger.debug("CodeRedeem", `Processing codes: Genshin (${genshin.length}), Star Rail (${starrail.length}), Zenless (${zenless.length})`);

			await Promise.all([
				processCodesForGame("genshin", genshin, redeemGenshin, telegram, webhook),
				processCodesForGame("starrail", starrail, redeemStarRail, telegram, webhook),
				processCodesForGame("nap", zenless, redeemZenless, telegram, webhook)
			]);

			app.Logger.info("CodeRedeem", "Code redemption process completed.");
		}
		catch (e) {
			console.error({
				message: "An error occurred during code redemption process",
				error: e
			});
		}
	}
};

async function processCodesForGame (gameName, codes, redeemFunction, telegram, webhook) {
	if (codes.length === 0) {
		app.Logger.debug("CodeRedeem", `No new codes for ${gameName}.`);
		return;
	}

	const accounts = app.HoyoLab.getActiveAccounts({ whitelist: gameName });
	if (accounts.length === 0) {
		app.Logger.debug("CodeRedeem", `No active accounts found for ${gameName}.`);
		return;
	}

	app.Logger.info("CodeRedeem", `Processing ${codes.length} code(s) for ${gameName} (${accounts.length} account(s)).`);

	for (const account of accounts) {
		if (account.redeemCode === false) {
			app.Logger.debug("CodeRedeem", `Code redemption disabled for account ${account.uid} (${gameName}).`);
			continue;
		}

		try {
			app.Logger.debug("CodeRedeem", `Redeeming codes for account ${account.uid} (${gameName}).`);
			const { success, failed } = await redeemFunction(account, codes);

			app.Logger.info("CodeRedeem", `Account ${account.uid} (${gameName}): ${success.length} code(s) redeemed, ${failed.length} failed.`);

			for (const code of [...success, ...failed]) {
				await sendNotification(success.includes(code), account, code, telegram, webhook);
			}
		}
		catch (e) {
			console.error({
				message: `Error processing codes for ${gameName} account ${account.uid}`,
				error: e
			});
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
		console.error({
			message: "Error sending notification",
			error: e
		});
	}
}
