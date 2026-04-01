module.exports = {
	name: "check-in",
	expression: "0 0 0 * * *",
	description: "Run daily check-in every day at midnight or your specified time",
	code: (async function checkIn () {
		const accounts = app.HoyoLab.getActiveAccounts();
		if (accounts.length === 0) {
			app.Logger.warn("Cron:CheckIn", "No active accounts found for HoyoLab");
			return;
		}

		const messages = [];
		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name	of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);

			const execution = await platform.checkIn();
			if (execution.length === 0) {
				app.Logger.info("Cron:CheckIn", "All accounts either signed in or failed to sign in");
				continue;
			}

			messages.push(...execution);
		}

		if (messages.length === 0) {
			app.Logger.info("Cron:CheckIn", "No accounts to run check-in for");
			return;
		}

		for (let i = 0; i < messages.length; i++) {
			const message = messages[i];
			const account = app.HoyoLab.getAccountById(message.uid);
			const platforms = app.Platform.getForAccount(account);

			let fields = [
				{ name: "UID", value: message.uid, inline: true },
				{ name: "Username", value: message.username, inline: true },
				{ name: "Region", value: message.region, inline: true },
				{ name: "Rank", value: message.rank, inline: true },
				{ name: "Today's Reward", value: `${message.award.name} x${message.award.count}`, inline: true },
				{ name: "Total Sign-ins", value: message.total, inline: true },
				{ name: "Result", value: message.result, inline: true }
			];

			if (message.platform === "tot") {
				fields = fields.filter(i => i.name !== "Username" && i.name !== "Rank");
			}

			const embed = {
				color: message.assets.color,
				title: message.assets.game,
				author: {
					name: message.assets.author,
					icon_url: message.assets.logo
				},
				thumbnail: {
					url: message.award.icon
				},
				fields,
				timestamp: new Date(),
				footer: {
					text: `HoyoLab Auto Check-In (${i + 1}/${messages.length}) Executed`,
					icon_url: message.assets.logo
				}
			};

			for (const webhook of platforms.filter(p => p.name === "webhook")) {
				await webhook.send(embed, {
					author: message.assets.author,
					icon: message.assets.logo
				});
			}

			const messageText = [
				`🎮 **${message.assets.game}** Daily Check-In`,
				`🆔 **(${message.uid})** ${message.username}`,
				`🌍 **Region:** ${message.region}`,
				`🏆 **Rank:** ${message.rank}`,
				`🎁 **Today's Reward:** ${message.award.name} x${message.award.count}`,
				`📅 **Total Sign-ins:** ${message.total}`,
				`📝 **Result:** ${message.result}`
			].join("\n");

			const escapedMessage = app.Utils.escapeCharacters(messageText);
			for (const telegram of platforms.filter(p => p.name === "telegram")) {
				await telegram.send(escapedMessage);
			}
		}
	})
};
