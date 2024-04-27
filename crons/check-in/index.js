module.exports = {
	name: "check-in",
	expression: "0 0 0 * * *",
	description: "Run daily check-in every day at midnight or your specified time",
	code: (async function checkIn () {
		const accounts = app.Account.getActivePlatforms();
		
		const messages = [];
		for (const account of accounts) {
			const checkIn = await app.HoyoLab.checkIn(account, account.type);
			messages.push(checkIn);
		}

		app.Logger.log("Cron:CheckIn", `Ran check-in for ${accounts.length} accounts.`);

		if (messages.length === 0) {
			return app.Logger.warn("Cron:CheckIn", "No messages to send.");
		}
		
		for (let i = 0; i < messages.length; i++) {
			const asset = app.Utils.assets(messages[i].platform);
			if (app.Webhook && app.Webhook.active) {
				const embed = {
					color: 0xBB0BB5,
					title: asset.game,
					author: {
						name: asset.author,
						icon_url: asset.icon
					},
					thumbnail: {
						url: messages[i].award.icon
					},
					fields: [
						{ name: "UID", value: messages[i].uid, inline: true },
						{ name: "Username", value: messages[i].username, inline: true },
						{ name: "Region", value: app.Utils.formattedAccountRegion(messages[i].region), inline: true },
						{ name: "Rank", value: messages[i].rank, inline: true },
						{ name: "Today's Reward", value: `${messages[i].award.name} x${messages[i].award.count}`, inline: true },
						{ name: "Total Sign-Ins", value: messages[i].total, inline: true },
						{ name: "Result", value: messages[i].result, inline: true }
					],
					timestamp: new Date(),
					footer: {
						text: `HoyoLab Auto Check-In (${i + 1} / ${messages.length} Executed)`,
						icon_url: asset.icon
					}
				};

				const messageData = await app.Webhook.handleMessage(embed, { type: "check-in" });
				if (messageData) {
					await app.Webhook.send(messageData);
				}
			}

			if (app.Telegram && app.Telegram.active) {
				const message = [
					`🎮 *${asset.game} Daily Check-In*`,
					`👤 *${messages[i].username}* (${messages[i].uid})`,
					`🏅 *Rank:* ${messages[i].rank}`,
					`🌍 *Region:* ${app.Utils.formattedAccountRegion(messages[i].region)}`,
					`🎁 *Today's Reward:* ${messages[i].award.name} x${messages[i].award.count}`,
					`📅 *Total Sign-Ins:* ${messages[i].total}`,
					`📝 *Result:* ${messages[i].result}`
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(message);
				await app.Telegram.send(escapedMessage);
			}
		}
	})
};
