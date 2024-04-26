module.exports = {
	name: "expedition",
	expression: "0 */30 * * * *",
	description: "Check for ongoing expeditions every 30 minutes and send a notification if all expeditions are completed.",
	code: (async function expedition () {
		const accounts = app.Account.getActivePlatforms();

		for (const account of accounts) {
			const accountData = app.Account.get(account.id);
			
			const { config: { expedition } } = accountData;
			if (expedition.check === false) {
				continue;
			}

			const expeditionData = await app.HoyoLab.expedition(account, account.type, expedition);
			if (expeditionData.length === 0) {
				continue;
			}

			const asset = app.Utils.assets(expeditionData.platform);
			if (app.Webhook && app.Webhook.active) {
				const embed = {
					color: 0xBB0BB5,
					title: `${asset.game} Expedition Notification`,
					author: {
						name: asset.author,
						icon_url: asset.icon
					},
					description: `${asset.game} Expedition is Completed`,
					fields: [
						{
							name: "UID",
							value: expeditionData.uid,
							inline: true
						},
						{
							name: "Username",
							value: expeditionData.username,
							inline: true
						}
					],
					timestamp: new Date(),
					footer: {
						text: `${asset.game} Expedition Check`,
						icon_url: asset.icon
					}
				};
				
				const messageData = await app.Webhook.handleMessage(embed, { type: "expedition" });
				if (messageData) {
					await app.Webhook.send(messageData);
				}
			}

			if (app.Telegram && app.Telegram.active) {
				const message = [
					`🎮 **${asset.game}**`,
					`👤 **${accountData.username}**'s (${accountData.uid})`,
					`🎉 **Expedition Completed**`
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(message);
				await app.Telegram.send(escapedMessage);
			}
		}
	})
};
