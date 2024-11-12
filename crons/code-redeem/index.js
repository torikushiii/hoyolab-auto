const {
	fetchCodes,
	checkAndRedeem,
	buildMessage
} = require("./utils");

module.exports = {
	name: "code-redeem",
	expression: "* * * * *",
	description: "Check and redeem codes for supported games from HoyoLab.",
	code: async function codeRedeem () {
		const accountData = app.HoyoLab.getActiveAccounts({
			blacklist: ["honkai", "tot"]
		});

		if (accountData.length === 0) {
			app.Logger.info("No active accounts found");
			return;
		}

		const redeemDisabled = accountData.every((i) => i.redeemCode === false);
		if (redeemDisabled) {
			app.Logger.info("CodeRedeem", "All accounts have redeem disabled");

			return;
		}

		const codes = await fetchCodes();
		if (Object.values(codes).every((i) => i.length === 0)) {
			app.Logger.debug("CodeRedeem", {
				message: "No codes found"
			});

			return;
		}

		const result = await checkAndRedeem(codes);
		if (typeof result === "undefined") {
			return;
		}

		const { success, failed } = result;
		if (success.length === 0 && failed.length === 0) {
			return;
		}

		const telegram = app.Platform.get(2);
		const webhook = app.Platform.get(3);

		if (telegram) {
			for (const data of success) {
				const message = buildMessage(true, data);
				const escapedMessage = app.Utils.escapeCharacters(message.telegram);

				await telegram.send(escapedMessage);
			}

			for (const data of failed) {
				const message = buildMessage(false, data);
				const escapedMessage = app.Utils.escapeCharacters(message.telegram);

				await telegram.send(escapedMessage);
			}
		}

		if (webhook) {
			for (const data of success) {
				const message = buildMessage(true, data);
				await webhook.send(message.embed);
			}

			for (const data of failed) {
				const message = buildMessage(false, data);
				await webhook.send(message.embed);
			}
		}
	}
};
