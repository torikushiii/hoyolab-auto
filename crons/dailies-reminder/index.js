module.exports = {
	name: "dailies-reminder",
	expression: "0 0 21 * * *",
	description: "Reminds you to complete your dailies.",
	code: (async function dailiesReminder () {
		const accounts = app.Account.getActivePlatforms();
		
		if (accounts.length === 0) {
			app.Logger.warn("Cron:DailiesReminder", "No active accounts found");
			return;
		}

		for (const account of accounts) {
			const accountData = app.Account.get(account.id);

			const { dailiesCheck } = accountData.config;
			if (dailiesCheck === false) {
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
					const delta = app.Utils.formatTime(notes.stamina.recoveryTime);
					const fields = app.Utils.fieldsBuilder({
						UID: accountData.uid,
						username: accountData.username,
						region,
						comission: `${notes.dailies.totalTasks}/${notes.dailies.finishedTasks}`,
						stamina: `${notes.stamina.currentStamina}/${notes.stamina.maxStamina} (${delta})`
					}, { comission: false });
	
					const embed = {
						color: 0xBB0BB5,
						title: "Dailies Reminder",
						author: {
							name: asset.author,
							icon_url: asset.icon
						},
						description: "👋 Hey! You still have dailies to complete!",
						fields,
						timestamp: new Date()
					};

					await app.Webhook.send(embed);
				}

				if (app.Telegram && app.Telegram.active) {
					const delta = app.Utils.formatTime(notes.stamina.recoveryTime);
					const message = [
						`👋 Hey! You still have dailies to complete!`,
						`🆔 UID: ${accountData.uid}`,
						`👤 Username: ${accountData.username}`,
						`🌍 Region: ${region}`,
						`📋 Comission: ${notes.dailies.totalTasks}/${notes.dailies.finishedTasks}`,
						`⚡ Stamina: ${notes.stamina.currentStamina}/${notes.stamina.maxStamina} (${delta})`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(message);
					await app.Telegram.send(escapedMessage);
				}
			}
		}
	})
};
