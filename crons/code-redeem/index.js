const { t } = require("../../localization/index.js");

const {
	fetchCodes,
	checkAndRedeem,
	buildMessage
} = require("./utils");

module.exports = {
	name: "code-redeem",
	expression: "* * * * *",
	description: t("Check and redeem codes for supported games from HoyoLab."),
	code: async function codeRedeem () {
		const accountData = app.HoyoLab.getActiveAccounts();

		if (accountData.length === 0) {
			app.Logger.info(t("No active accounts found"));
			return;
		}

		const redeemDisabled = accountData.every((i) => i.redeemCode === false);
		if (redeemDisabled) {
			app.Logger.info("CodeRedeem", t("All accounts have redeem disabled"));

			return;
		}

		const codes = await fetchCodes();
		if (Object.values(codes).every((i) => i.length === 0)) {
			app.Logger.debug("CodeRedeem", {
				message: t("No codes found")
			});

			return;
		}

		const result = await checkAndRedeem(codes);
		if (typeof result === "undefined") {
			return;
		}

		const { success, failed, manual } = result;
		if (success.length === 0 && failed.length === 0 && manual.length === 0) {
			return;
		}

		for (const data of success) {
			const message = buildMessage("success", data);
			const platforms = app.Platform.getForAccount(data.account);
			const escapedMessage = app.Utils.escapeCharacters(message.telegram);

			for (const telegram of platforms.filter(p => p.name === "telegram")) {
				await telegram.send(escapedMessage);
			}
			for (const destination of app.Platform.getEmbedPlatforms(platforms)) {
				await destination.send(message.embed);
			}
		}

		for (const data of failed) {
			const message = buildMessage("failed", data);
			const platforms = app.Platform.getForAccount(data.account);
			const escapedMessage = app.Utils.escapeCharacters(message.telegram);

			const notified = new Set(await app.Cache.get(data.notificationKey) ?? []);
			for (const platform of platforms.filter(p => ["telegram", "webhook", "gotify"].includes(p.name))) {
				if (notified.has(platform.id)) {
					continue;
				}
				try {
					if (platform.name === "telegram") {
						await platform.send(escapedMessage);
					}
					else {
						const userId = [-2006, -2017].includes(data.retcode) ? null : platform.createUserMention(data.account.discord);
						await platform.send(message.embed, { content: userId });
					}
					notified.add(platform.id);
					await app.Cache.set({
						key: data.notificationKey,
						value: [...notified]
					});
				}
				catch (e) {
					app.Logger.error("CodeRedeem", `Could not notify ${platform.name} (${platform.id}) for account ${data.account.uid}: ${e.message}`);
				}
			}
		}

		// manual entries are game-level (no account), so send to all platforms
		for (const data of manual) {
			const message = buildMessage("manual", data);
			const escapedMessage = app.Utils.escapeCharacters(message.telegram);

			for (const telegram of app.Platform.list.filter(p => p.name === "telegram")) {
				await telegram.send(escapedMessage);
			}
			for (const destination of app.Platform.getEmbedPlatforms()) {
				await destination.send(message.embed);
			}
		}
	}
};
