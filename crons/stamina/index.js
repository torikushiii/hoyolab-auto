module.exports = {
	name: "stamina",
	expression: "0 */30 * * * *",
	description: "Check for your stamina and notify you when it's within the set threshold.",
	code: (async function stamina () {
		const accounts = app.Account.getActivePlatforms();

		for (const account of accounts) {
			const accountData = app.Account.get(account.id);
			
			const { config: { stamina } } = accountData;
			if (stamina.check === false) {
				continue;
			}

			const staminaData = await app.HoyoLab.stamina(account, account.type, stamina);
			if (staminaData === null) {
				continue;
			}

			const asset = app.Utils.assets(staminaData.platform);
			if (app.Webhook && app.Webhook.active) {
				const recoveryTime = app.Utils.formatTime(staminaData.recoveryTime);
				const embed = {
					color: 0xBB0BB5,
					title: `${asset.game} Stamina Notification`,
					author: {
						name: asset.author,
						icon_url: asset.icon
					},
					fields: [
						{
							name: "UID",
							value: accountData.uid,
							inline: true
						},
						{
							name: "Username",
							value: accountData.username,
							inline: true
						},
						{
							name: "\u200b",
							value: "\u200b",
							inline: true
						},
						{
							name: "Current Stamina",
							value: `${staminaData.currentStamina}/${staminaData.maxStamina}`,
							inline: true
						},
						{
							name: "Recovery Time",
							value: recoveryTime,
							inline: true
						}
					],
					timestamp: new Date(),
					footer: {
						text: `${asset.game} Stamina Check`,
						icon_url: asset.icon
					}
				};

				const messageData = await app.Webhook.handleMessage(embed, { type: "stamina" });
				if (messageData) {
					await app.Webhook.send(messageData);
				}
			}

			if (app.Telegram && app.Telegram.active) {
				const recoveryTime = app.Utils.formatTime(staminaData.recoveryTime);
				const message = [
					`🎮 **${asset.game}**`,
					`🎒 **${accountData.username}**'s (${accountData.uid})`,
					`🎉 **Stamina Notification**`,
					`🔋 **Current Stamina**: ${staminaData.currentStamina}/${staminaData.maxStamina}`,
					`🕒 **Recovery Time**: ${recoveryTime}`
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(message);
				await app.Telegram.send(escapedMessage);
			}
		}
	})
};
