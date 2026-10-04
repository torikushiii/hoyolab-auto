const { t } = require("../../localization/index.js");

module.exports = {
	name: "shop-status",
	expression: "0 */1 * * *",
	description: t("This will check your current shop status and will fire a notification if your shop has finished selling."),
	code: (async function shopStatus () {
		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "nap" });
		if (accounts.length === 0) {
			app.Logger.warn("Cron:ShopStatus", t("No active accounts found to run shop status for."));
			return;
		}

		const platform = app.HoyoLab.get("nap");
		for (const account of accounts) {
			if (account.shop.check === false) {
				continue;
			}

			const notes = await platform.notes(account);
			if (notes.success === false) {
				continue;
			}

			const { data } = notes;

			const shop = data.shop;
			if (shop.state !== "Finished") {
				account.shop.fired = false;
				platform.update(account);
				continue;
			}

			if (account.shop.fired) {
				continue;
			}

			if (shop.state === "Finished") {
				account.shop.fired = true;
				platform.update(account);

				const platforms = app.Platform.getForAccount(account);
				const region = app.HoyoLab.getRegion(account.region);
				const embed = {
					color: data.assets.color,
					title: t("Shop Status"),
					author: {
						name: t `${region} Server - ${account.nickname}`,
						icon_url: data.assets.logo
					},
					description: t("Your shop has finished selling videos!"),
					thumbnail: {
						url: data.assets.logo
					},
					timestamp: new Date(),
					footer: {
						text: t("Shop Status"),
						icon_url: data.assets.logo
					}
				};

				for (const destination of app.Platform.getEmbedPlatforms(platforms)) {
					const userId = destination.createUserMention(account.discord);
					await destination.send(embed, {
						content: userId,
						author: data.assets.author,
						icon: data.assets.logo
					});
				}

				const messageText = [
					t `🛒 Shop Status`,
					t `UID: ${account.uid} ${account.nickname}`,
					t `Your shop has finished selling videos!`
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(messageText);
				for (const telegram of platforms.filter(p => p.name === "telegram")) {
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
