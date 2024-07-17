module.exports = {
	name: "realmCurrency",
	expression: "0 */1 * * *",
	description: "This cron will check your Tea Pot Realm currency and notify you if it's full",
	code: (async function realmCurrency () {
		const accountList = app.HoyoLab.getActiveAccounts({ whitelist: "genshin" });
		if (accountList.length === 0) {
			app.Logger.warn("Cron:RealmCurrency", "No active accounts to run the cron");
			return;
		}

		const platform = app.HoyoLab.get("genshin");
		for (const account of accountList) {
			const realm = account.realm;
			if (realm.check === false) {
				continue;
			}

			if (realm.fired && !realm.persistent) {
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

			if (coins.currentCoin === coins.maxCoin) {
				realm.fired = true;
				platform.update(account);

				const webhook = app.Platform.get(3);
				if (webhook) {
					const region = app.HoyoLab.getRegion(account.region);
					const embed = {
						color: data.assets.color,
						title: "Realm Currency",
						author: {
							name: `${region} Server - ${account.nickname}`,
							icon_url: data.assets.logo
						},
						description: "Your realm currency is full!",
						fields: [
							{
								name: "Current Realm Currency",
								value: `${coins.currentCoin}/${coins.maxCoin}`,
								inline: true
							}
						],
						thumbnail: {
							url: data.assets.logo
						},
						timestamp: new Date(),
						footer: {
							text: "Realm Currency",
							icon_url: data.assets.logo
						}
					};

					await webhook.send(embed, {
						author: data.assets.author,
						icon: data.assets.logo
					});
				}

				const telegram = app.Platform.get(2);
				if (telegram) {
					const messageText = [
						`💰 Realm Currency`,
						`UID: ${account.uid} ${account.nickname}`,
						`Your realm currency is full!`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(messageText);
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
