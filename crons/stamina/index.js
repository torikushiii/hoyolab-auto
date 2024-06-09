module.exports = {
	name: "stamina",
	expression: "0 */30 * * * *",
	description: "Check for your stamina and notify you when it's within the set threshold.",
	code: (async function stamina () {
		// eslint-disable-next-line object-curly-spacing
		const accountsList = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai"] });
		if (accountsList.length === 0) {
			app.Logger.warn("Cron:Stamina", "No active accounts found to run stamina check for.");
			return;
		}

		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);
			const accounts = accountsList.filter(account => account.platform === name);

			for (const account of accounts) {
				const staminaCheck = account.stamina.check;
				if (staminaCheck === false) {
					continue;
				}

				const { fired, persistent } = account.stamina;
				if (fired && !persistent) {
					continue;
				}

				const notes = await platform.notes(account);
				if (notes.success === false) {
					continue;
				}

				const { data } = notes;
				const stamina = data.stamina;

				const current = stamina.currentStamina;
				if (current < account.stamina.threshold) {
					account.stamina.fired = false;
					platform.update(account);
					continue;
				}

				const max = stamina.maxStamina;
				const delta = app.Utils.formatTime(stamina.recoveryTime);
				
				account.stamina.fired = true;
				platform.update(account);

				const webhook = app.Platform.get(3);
				if (webhook) {
					const embed = {
						color: data.assets.color,
						title: "Stamina Reminder",
						author: {
							name: data.assets.author,
							icon_url: data.assets.logo
						},
						description: "Your stamina is within the set threshold!",
						fields: [
							{ name: "UID", value: account.uid, inline: true },
							{ name: "Username", value: account.nickname, inline: true },
							{ name: "Region", value: app.Utils.formattedAccountRegion(account.region), inline: true },
							{ name: "Stamina", value: `${current}/${max}`, inline: true },
							{ name: "Recovery Time", value: delta, inline: true }
						],
						timestamp: new Date(),
						footer: {
							text: "Stamina Reminder",
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
						`📢 Stamina Reminder, Your Stamina is Within the Set Threshold!`,
						`🎮 **Game**: ${data.assets.game}`,
						`🆔 **UID**: ${account.uid} ${account.nickname}`,
						`🌍 **Region**: ${app.Utils.formattedAccountRegion(account.region)}`,
						`🔋 **Stamina**: ${current}/${max}`,
						`🕒 **Recovery Time**: ${delta}`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(messageText);
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
