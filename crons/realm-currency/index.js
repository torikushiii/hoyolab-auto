const { t } = require("../../localization/index.js");

module.exports = {
	name: "realm-currency",
	expression: "0 */1 * * *",
	description: t("This cron will check your Tea Pot Realm currency and notify you if it's full"),
	code: (async function realmCurrency () {
		const accountList = app.HoyoLab.getActiveAccounts({ whitelist: "genshin" });
		if (accountList.length === 0) {
			app.Logger.warn("Cron:RealmCurrency", t("No active accounts to run the cron"));
			return;
		}

		const platform = app.HoyoLab.get("genshin");
		for (const account of accountList) {
			const realm = account.realm;
			if (realm.check === false) {
				continue;
			}

			const notes = await platform.notes(account);
			if (notes.success === false) {
				continue;
			}

			const { data } = notes;
			const coins = data.realm;
			if (coins.currentCoin < coins.maxCoin) {
				realm.fired = false;
				platform.update(account);
				continue;
			}

			if (realm.fired && !realm.persistent) {
				continue;
			}

			if (coins.currentCoin === coins.maxCoin) {
				realm.fired = true;
				platform.update(account);

				const platforms = app.Platform.getForAccount(account);
				const region = app.HoyoLab.getRegion(account.region);
				const embed = {
					color: data.assets.color,
					title: t("Realm Currency"),
					author: {
						name: t `${region} Server - ${account.nickname}`,
						icon_url: data.assets.logo
					},
					description: t("Your realm currency is full!"),
					fields: [
						{
							name: t("Current Realm Currency"),
							value: `${coins.currentCoin}/${coins.maxCoin}`,
							inline: true
						}
					],
					thumbnail: {
						url: data.assets.logo
					},
					timestamp: new Date(),
					footer: {
						text: t("Realm Currency"),
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
					t `💰 Realm Currency`,
					t `UID: ${account.uid} ${account.nickname}`,
					t `Your realm currency is full!`
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(messageText);
				for (const telegram of platforms.filter(p => p.name === "telegram")) {
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
