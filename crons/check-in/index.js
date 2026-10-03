const { t } = require("../../localization/index.js");

module.exports = {
	name: "check-in",
	expression: "0 0 0 * * *",
	description: t("Run daily check-in every day at midnight or your specified time"),
	code: (async function checkIn () {
		const accounts = app.HoyoLab.getActiveAccounts();
		if (accounts.length === 0) {
			app.Logger.warn("Cron:CheckIn", t("No active accounts found for HoyoLab"));
			return;
		}

		const messages = [];
		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name	of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);

			const execution = await platform.checkIn();
			if (execution.length === 0) {
				app.Logger.info("Cron:CheckIn", t("All accounts either signed in or failed to sign in"));
				continue;
			}

			messages.push(...execution);
		}

		if (messages.length === 0) {
			app.Logger.info("Cron:CheckIn", t("No accounts to run check-in for"));
			return;
		}

		for (let i = 0; i < messages.length; i++) {
			const message = messages[i];
			const account = app.HoyoLab.getAccountById(message.uid);
			const platforms = app.Platform.getForAccount(account);

			let fields = [
				{ name: "UID", value: message.uid, inline: true },
				{ name: t("Username"), value: message.username, inline: true },
				{ name: t("Region"), value: message.region, inline: true },
				{ name: t("Rank"), value: message.rank, inline: true },
				{ name: t("Today's Reward"), value: `${message.award.name} x${message.award.count}`, inline: true },
				{ name: t("Total Sign-ins"), value: message.total, inline: true },
				{ name: t("Result"), value: message.result, inline: true }
			];

			if (message.platform === "tot") {
				fields = fields.filter(i => i.name !== t("Username") && i.name !== t("Rank"));
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
					text: t `HoyoLab Auto Check-In (${i + 1}/${messages.length}) Executed`,
					icon_url: message.assets.logo
				}
			};

			for (const destination of app.Platform.getEmbedPlatforms(platforms)) {
				await destination.send(embed, {
					author: message.assets.author,
					icon: message.assets.logo
				});
			}

			const messageText = [
				t `🎮 **${message.assets.game}** Daily Check-In`,
				`🆔 **(${message.uid})** ${message.username}`,
				t `🌍 **Region:** ${message.region}`,
				t `🏆 **Rank:** ${message.rank}`,
				t `🎁 **Today's Reward:** ${message.award.name} x${message.award.count}`,
				t `📅 **Total Sign-ins:** ${message.total}`,
				t `📝 **Result:** ${message.result}`
			].join("\n");

			const escapedMessage = app.Utils.escapeCharacters(messageText);
			for (const telegram of platforms.filter(p => p.name === "telegram")) {
				await telegram.send(escapedMessage);
			}
		}
	})
};
