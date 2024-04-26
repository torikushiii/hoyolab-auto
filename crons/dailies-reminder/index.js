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

			const isCompleted = (notes.dailies.finishedTasks === notes.dailies.totalTasks);
			if (isCompleted) {
				continue;
			}

			const asset = app.Utils.assets(account.type);
			const region = app.Utils.formattedAccountRegion(accountData.region);

			if (app.Webhook && app.Webhook.active) {
				const fields = app.Utils.fieldsBuilder({
					UID: accountData.uid,
					Username: accountData.username,
					Region: region
				});

				const delta = app.Utils.formatTime(notes.stamina.recoveryTime);
				fields.push(
					{
						name: "Comission Completed",
						value: `${notes.dailies.totalTasks}/${notes.dailies.finishedTasks}`,
						inline: true
					},
					{
						name: "Stamina Recovery",
						value: `${notes.stamina.currentStamina}/${notes.stamina.maxStamina} (${delta})`,
						inline: true
					}
				);

				const embed = {
					color: 0xBB0BB5,
					title: "Dailies Reminder",
					author: {
						name: asset.author,
						icon_url: asset.icon
					},
					description: "Don't forget to complete your dailies!",
					fields,
					timestamp: new Date(),
					footer: {
						text: "Dailies Reminder",
						icon_url: asset.icon
					}
				};

				if (account.type === "genshin") {
					const discountExhausted = (notes.weeklies.resinDiscount === 0);
					if (!discountExhausted) {
						embed.fields.push({
							name: "Resin Discount",
							value: `${notes.weeklies.resinDiscount}/${notes.weeklies.resinDiscountLimit}`,
							inline: true
						});
					}
				}

				const message = app.Webhook.prepareMessage(embed, { type: "dailies" });
				if (message) {
					await app.Webhook.send(message);
				}
			}

			if (app.Telegram && app.Telegram.active) {
				const message = [
					`📢 **Dailies Reminder, Don't Forget to Do Your Dailies**`,
					`👤 **${accountData.username}**`,
					`🔢 **UID**: ${accountData.uid}`,
					`🌍 **Region**: ${region}`,
					`📋 **Comission Completed**: ${notes.dailies.totalTasks}/${notes.dailies.finishedTasks}`
				];

				if (account.type === "genshin") {
					const discountExhausted = (notes.weeklies.resinDiscount === 0);
					if (!discountExhausted) {
						message.push(`🔋 **Resin Discount**: ${notes.weeklies.resinDiscount}/${notes.weeklies.resinDiscountLimit}`);
					}
				}

				const delta = app.Utils.formatTime(notes.stamina.recoveryTime);
				message.push(`🕒 **Stamina Recovery**: ${notes.stamina.currentStamina}/${notes.stamina.maxStamina} (${delta})`);

				const text = app.Telegram.prepareMessage(message.join("\n"));
				if (text) {
					await app.Telegram.send(text);
				}
			}
		}
	})
};
