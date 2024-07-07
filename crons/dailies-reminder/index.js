module.exports = {
	name: "dailies-reminder",
	expression: "0 0 21 * * *",
	description: "Reminds you to complete your dailies.",
	code: (async function dailiesReminder () {
		// eslint-disable-next-line object-curly-spacing
		const accountsList = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai"] });
		if (accountsList.length === 0) {
			app.Logger.warn("Cron:DailiesReminder", "No active accounts found to run dailies reminder for.");
			return;
		}

		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);
			const accounts = accountsList.filter(account => account.platform === name);

			for (const account of accounts) {
				const dailiesCheck = account.dailiesCheck;
				if (dailiesCheck === false) {
					continue;
				}

				const notes = await platform.notes(account);
				if (notes.success === false) {
					continue;
				}

				const { data } = notes;
				const current = data.stamina.currentStamina;
				const max = data.stamina.maxStamina;
				const delta = app.Utils.formatTime(data.stamina.recoveryTime);

				const webhook = app.Platform.get(3);
				if (webhook) {
					const embed = {
						color: data.assets.color,
						title: "Dailies Reminder",
						author: {
							name: data.assets.author,
							icon_url: data.assets.logo
						},
						description: "Don't forget to complete your dailies!",
						fields: [
							{ name: "UID", value: account.uid, inline: true },
							{ name: "Username", value: account.nickname, inline: true },
							{ name: "Region", value: app.Utils.formattedAccountRegion(account.region), inline: true },
							{ name: "Completed Dailies", value: `${data.dailies.task}/${data.dailies.maxTask}`, inline: true },
							{ name: "Current Stamina", value: `${current}/${max} (${delta})`, inline: true }
						],
						timestamp: new Date(),
						footer: {
							text: "Dailies Reminder",
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
						`📢 Dailies Reminder, Don't Forget to Do Your Dailies!`,
						`🎮 **Game**: ${data.assets.game}`,
						`🆔 **UID**: ${account.uid} ${account.nickname}`,
						`🌍 **Region**: ${app.Utils.formattedAccountRegion(account.region)}`,
						`📅 **Completed Dailies**: ${data.dailies.task}/${data.dailies.maxTask}`,
						`🔋 **Current Stamina**: ${current}/${max} (${delta})`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(messageText);
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
