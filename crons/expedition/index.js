module.exports = {
	name: "expedition",
	expression: "0 */30 * * * *",
	description: "Check for ongoing expeditions every 30 minutes and send a notification if all expeditions are completed.",
	code: (async function expedition () {
		// eslint-disable-next-line object-curly-spacing
		const accountList = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai", "nap", "tot"] });
		if (accountList.length === 0) {
			app.Logger.warn("Cron:Expedition", "No active accounts found to run expedition check for.");
			return;
		}

		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);
			const accounts = accountList.filter(account => account.platform === name);

			for (const account of accounts) {
				const expeditionCheck = account.expedition.check;
				if (expeditionCheck === false) {
					continue;
				}

				const notes = await platform.notes(account);
				if (notes.success === false) {
					continue;
				}

				const { fired, persistent } = account.expedition;
				if (fired && !persistent) {
					continue;
				}

				account.expedition.fired = true;
				platform.update(account);

				const { data } = notes;
				const expeditions = data.expedition;
				if (expeditions.completed === false) {
					account.expedition.fired = false;
					platform.update(account);
					continue;
				}

				const webhook = app.Platform.get(3);
				if (webhook) {
					const embed = {
						color: data.assets.color,
						title: "Expedition Reminder",
						author: {
							name: data.assets.author,
							icon_url: data.assets.logo
						},
						description: "All expeditions are completed!",
						fields: [
							{ name: "UID", value: account.uid, inline: true },
							{ name: "Username", value: account.nickname, inline: true },
							{ name: "Region", value: app.HoyoLab.getRegion(account.region), inline: true }
						],
						timestamp: new Date(),
						footer: {
							text: "Expedition Reminder",
							icon_url: data.assets.logo
						}
					};

					const userId = webhook.createUserMention(account.discord);
					await webhook.send(embed, {
						content: userId,
						author: data.assets.author,
						icon: data.assets.logo
					});
				}

				const telegram = app.Platform.get(2);
				if (telegram) {
					const messageText = [
						`📢 Expedition Reminder, All Expeditions are Completed!`,
						`🎮 **Game**: ${data.assets.game}`,
						`🆔 **UID**: ${account.uid} ${account.nickname}`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(messageText);
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
