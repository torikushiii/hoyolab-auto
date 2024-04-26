module.exports = {
	name: "weeklies-reminder",
	expression: "0 0 21 * * 0",
	description: "Reminds you to complete your weeklies.",
	code: (async function weekliesReminder () {
		const accounts = app.Account.getActivePlatforms();
		
		if (accounts.length === 0) {
			app.Logger.warn("Cron:WeekliesReminder", "No active accounts found");
			return;
		}

		for (const account of accounts) {
			const accountData = app.Account.get(account.id);

			const { weekliesCheck } = accountData.config;
			if (weekliesCheck === false) {
				continue;
			}

			const notes = await app.HoyoLab.getNotes(account, account.type, {
				uid: accountData.uid,
				region: accountData.region
			});

			const asset = app.Utils.assets(account.type);
			if (account.type === "starrail") {
				const region = app.Utils.formattedAccountRegion(accountData.region);
				
				if (app.Webhook && app.Webhook.active) {
					const fields = app.Utils.fieldsBuilder({
						UID: accountData.uid,
						username: accountData.username,
						region
					});

					const cocoonCompleted = (notes.weeklies.weeklyCocoonCount === 0);
					const simCimpleted = (notes.weeklies.rogueScore === notes.weeklies.maxRogueScore);
					const weeklyCompleted = (cocoonCompleted && simCimpleted);
					if (weeklyCompleted) {
						continue;
					}

					if (cocoonCompleted === false) {
						fields.push({
							name: "Echo of War",
							value: `${notes.weeklies.weeklyCocoonCount}/${notes.weeklies.weeklyCocoonLimit}`,
							inline: false
						});
					}
					if (simCimpleted === false) {
						fields.push({
							name: "Simulated Universe",
							value: `${notes.weeklies.rogueScore}/${notes.weeklies.maxRogueScore}`,
							inline: false
						});
					}

					const embed = {
						color: 0xBB0BB5,
						title: `${asset.game} Weeklies Reminder`,
						description: "👋 Hey! You still have weeklies to do!",
						author: {
							name: asset.author,
							icon_url: asset.icon
						},
						fields,
						timestamp: new Date()
					};

					const messageData = await app.Webhook.handleMessage(embed, { type: "weeklies" });
					if (messageData) {
						await app.Webhook.send(messageData);
					}
				}
				
				if (app.Telegram && app.Telegram.active) {
					const message = [
						`🎮 **${asset.game}**`,
						`🎒 **${accountData.username}**'s (${accountData.uid})`,
						`👋 Hey! You still have weeklies to do!`,
						`👹 **Echo of War:** ${notes.weeklies.weeklyCocoonCount}/${notes.weeklies.weeklyCocoonLimit}`,
						`🌌 **Simulated Universe:** ${notes.weeklies.rogueScore}/${notes.weeklies.maxRogueScore}`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(message);
					await app.Telegram.send(escapedMessage);
				}
			}
		}
	})
};
