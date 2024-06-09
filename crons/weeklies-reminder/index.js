module.exports = {
	name: "weeklies-reminder",
	expression: "0 0 21 * * 0",
	description: "Reminds you to complete your weeklies.",
	code: (async function weekliesReminder () {
		// eslint-disable-next-line object-curly-spacing
		const accountsList = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai"] });
		if (accountsList.length === 0) {
			app.Logger.warn("Cron:WeekliesReminder", "No active accounts found to run weeklies check for.");
			return;
		}

		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);
			const accounts = accountsList.filter(account => account.platform === name);

			for (const account of accounts) {
				const weekliesCheck = account.weekliesCheck;
				if (weekliesCheck === false) {
					continue;
				}

				const notes = await platform.notes(account);
				if (notes.success === false) {
					continue;
				}

				const { data } = notes;
				const weeklies = data.weeklies;

				const webhook = app.Platform.get(3);
				if (webhook) {
					const embed = {
						color: data.assets.color,
						title: "Weeklies Reminder",
						author: {
							name: data.assets.author,
							icon_url: data.assets.logo
						},
						description: "Don't forget to complete your weeklies!",
						fields: [
							{ name: "UID", value: account.uid, inline: true },
							{ name: "Username", value: account.nickname, inline: true },
							{ name: "Region", value: app.Utils.formattedAccountRegion(account.region), inline: true }
						],
						timestamp: new Date(),
						footer: {
							text: "Weeklies Reminder",
							icon_url: data.assets.logo
						}
					};

					if (platform.type === "genshin") {
						const resin = weeklies.resinDiscount;
						const limit = weeklies.resinDiscountLimit;

						// This means you've already did the weekly boss using the resin discount.
						if (resin === 0) {
							continue;
						}

						embed.fields.push({
							name: "Resin Discount",
							value: `${resin}/${limit} Available`,
							inline: true
						});
					}
					if (platform.type === "starrail") {
						const bossCompleted = (weeklies.weeklyBoss === 0);
						const simCompleted = (weeklies.rogueScore === weeklies.maxScore);
						if (bossCompleted && simCompleted) {
							continue;
						}

						if (!bossCompleted) {
							embed.fields.push({
								name: "Weekly Boss",
								value: `${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit} Completed`,
								inline: true
							});
						}
						if (!simCompleted) {
							embed.fields.push({
								name: "Simulated Universe",
								value: `${weeklies.rogueScore}/${weeklies.maxScore}`,
								inline: true
							});
						}
					}

					await webhook.send(embed, {
						author: data.assets.author,
						icon: data.assets.logo
					});
				}

				const telegram = app.Platform.get(2);
				if (telegram) {
					const message = [
						"📅 **Weeklies Reminder**",
						"",
						"👤 **Account**",
						`- **UID**: ${account.uid}`,
						`- **Username**: ${account.nickname}`,
						`- **Region**: ${app.Utils.formattedAccountRegion(account.region)}`,
						"",
						"📊 **Progress**"
					];

					if (platform.type === "genshin") {
						const resin = weeklies.resinDiscount;
						const limit = weeklies.resinDiscountLimit;

						if (resin === 0) {
							continue;
						}

						message.push(`- **Resin Discount**: ${resin}/${limit} Available`);
					}
					if (platform.type === "starrail") {
						const bossCompleted = (weeklies.weeklyBoss === 0);
						const simCompleted = (weeklies.rogueScore === weeklies.maxScore);
						if (bossCompleted && simCompleted) {
							continue;
						}

						if (!bossCompleted) {
							message.push(`- **Weekly Boss**: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit} Completed`);
						}
						if (!simCompleted) {
							message.push(`- **Simulated Universe**: ${weeklies.rogueScore}/${weeklies.maxScore}`);
						}
					}

					const escapedMessage = app.Utils.escapeCharacters(message.join("\n"));
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
