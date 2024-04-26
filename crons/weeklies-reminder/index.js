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
			const region = app.Utils.formattedAccountRegion(accountData.region);

			if (app.Webhook && app.Webhook.active) {
				const fields = app.Utils.fieldsBuilder({
					UID: accountData.uid,
					Username: accountData.username,
					Region: region
				});

				if (account.type === "genshin") {
					const weeklyCompleted = (notes.weeklies.resinDiscount === 0);
					if (weeklyCompleted) {
						continue;
					}

					fields.push({
						name: "Resin Discount",
						value: `${notes.weeklies.resinDiscount}/${notes.weeklies.resinDiscountLimit}`,
						inline: true
					});
				}
				if (account.type === "starrail") {
					const cocoonCompleted = (notes.weeklies.weeklyCocoonCount === 0);
					const simCompleted = (notes.weeklies.rogueScore === notes.weeklies.maxRogueScore);
					if (cocoonCompleted && simCompleted) {
						continue;
					}

					if (!cocoonCompleted) {
						fields.push({
							name: "Echo of War",
							value: `${notes.weeklies.weeklyCocoonCount}/${notes.weeklies.weeklyCocoonLimit}`,
							inline: true
						});
					}
					if (!simCompleted) {
						fields.push({
							name: "Simulated Universe",
							value: `${notes.weeklies.rogueScore}/${notes.weeklies.maxRogueScore}`,
							inline: true
						});
					}
				}

				const embed = {
					color: 0xBB0BB5,
					title: "Weeklies Reminder",
					author: {
						name: asset.author,
						icon_url: asset.icon
					},
					description: `${asset.game} Weeklies Reminder`,
					fields,
					timestamp: new Date(),
					footer: {
						text: "Weeklies Reminder",
						icon_url: asset.icon
					}
				};

				const messageData = await app.Webhook.handleMessage(embed, { type: "weeklies" });
				if (messageData) {
					await app.Webhook.send(messageData);
				}
			}

			if (app.Telegram && app.Telegram.active) {
				const message = [
					`📢 **Weeklies Reminder, Don't Forget to Do Your Weeklies**`,
					`👤 **${accountData.username}**`,
					`🔢 **UID**: ${accountData.uid}`,
					`🌍 **Region**: ${region}`
				];

				if (account.type === "genshin") {
					const weeklyCompleted = (notes.weeklies.resinDiscount === 0);
					if (weeklyCompleted) {
						continue;
					}

					message.push(`🔋 **Resin Discount**: ${notes.weeklies.resinDiscount}/${notes.weeklies.resinDiscountLimit}`);
				}
				if (account.type === "starrail") {
					const cocoonCompleted = (notes.weeklies.weeklyCocoonCount === 0);
					const simCompleted = (notes.weeklies.rogueScore === notes.weeklies.maxRogueScore);
					if (cocoonCompleted && simCompleted) {
						continue;
					}

					if (!cocoonCompleted) {
						message.push(`👹 **Echo of War**: ${notes.weeklies.weeklyCocoonCount}/${notes.weeklies.weeklyCocoonLimit}`);
					}
					if (!simCompleted) {
						message.push(`🌌 **Simulated Universe**: ${notes.weeklies.rogueScore}/${notes.weeklies.maxRogueScore}`);
					}
				}

				const text = app.Telegram.prepareMessage(message.join("\n"));
				if (text) {
					await app.Telegram.send(text);
				}
			}
		}
	})
};
