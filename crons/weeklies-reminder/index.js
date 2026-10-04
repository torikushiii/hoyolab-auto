const { t } = require("../../localization/index.js");

const RegionalTaskManager = new app.RegionalTaskManager();

RegionalTaskManager.registerTask("WeekliesReminder", 21, 0, async (account) => {
	const weekliesCheck = account.weekliesCheck;
	if (weekliesCheck === false) {
		return;
	}

	const platform = app.HoyoLab.get(account.platform);
	const notes = await platform.notes(account);
	if (notes.success === false) {
		return;
	}

	const { data } = notes;
	const weeklies = data.weeklies;

	const platforms = app.Platform.getForAccount(account);
	const embedPlatforms = app.Platform.getEmbedPlatforms(platforms);
	const telegrams = platforms.filter(p => p.name === "telegram");
	if (embedPlatforms.length > 0) {
		const embed = {
			color: data.assets.color,
			title: t("Weeklies Reminder"),
			author: {
				name: data.assets.author,
				icon_url: data.assets.logo
			},
			description: t("Don't forget to complete your weeklies!"),
			fields: [
				{ name: "UID", value: account.uid, inline: true },
				{ name: t("Username"), value: account.nickname, inline: true },
				{ name: t("Region"), value: app.HoyoLab.getRegion(account.region), inline: true }
			],
			timestamp: new Date(),
			footer: {
				text: t("Weeklies Reminder"),
				icon_url: data.assets.logo
			}
		};

		if (platform.type === "genshin") {
			const resin = weeklies.resinDiscount;
			const limit = weeklies.resinDiscountLimit;

			if (resin !== 0) {
				embed.fields.push({
					name: t("Resin Discount"),
					value: t `${resin}/${limit} Available`,
					inline: true
				});
			}
		}
		if (platform.type === "starrail") {
			const bossCompleted = (weeklies.weeklyBoss === 0);
			const simCompleted = (weeklies.rogueScore === weeklies.maxScore);
			const divergent = (weeklies.tournScore === weeklies.tournMaxScore && weeklies.tournUnlocked);
			if (bossCompleted && simCompleted && divergent) {
				return;
			}

			if (!bossCompleted) {
				embed.fields.push({
					name: t("Weekly Boss"),
					value: t `${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit} Completed`,
					inline: true
				});
			}
			if (!simCompleted) {
				embed.fields.push({
					name: t("Simulated Universe"),
					value: `${weeklies.rogueScore}/${weeklies.maxScore}`,
					inline: true
				});
			}
			if (!divergent) {
				embed.fields.push({
					name: t("Divergent Universe"),
					value: `${weeklies.tournScore}/${weeklies.tournMaxScore}`,
					inline: true
				});
			}
		}
		if (platform.type === "nap") {
			const bountiesCompleted = (weeklies.bounty === weeklies.bountyTotal);
			const surveyCompleted = (weeklies.surveyPoints === weeklies.surveyPointsTotal);
			if (bountiesCompleted && surveyCompleted) {
				return;
			}

			if (!bountiesCompleted) {
				embed.fields.push({
					name: t("Bounty Commission"),
					value: `${weeklies.bounty}/${weeklies.bountyTotal}`,
					inline: true
				});
			}
			if (!surveyCompleted) {
				embed.fields.push({
					name: t("Survey Points"),
					value: `${weeklies.surveyPoints}/${weeklies.surveyPointsTotal}`,
					inline: true
				});
			}
		}

		for (const destination of embedPlatforms) {
			const userId = destination.createUserMention(account.discord);
			await destination.send(embed, {
				content: userId,
				author: data.assets.author,
				icon: data.assets.logo
			});
		}
	}

	if (telegrams.length > 0) {
		const message = [
			t("📅 **Weeklies Reminder**"),
			"",
			t("👤 **Account**"),
			t `- **UID**: ${account.uid}`,
			t `- **Username**: ${account.nickname}`,
			t `- **Region**: ${app.HoyoLab.getRegion(account.region)}`,
			"",
			t("📊 **Progress**")
		];

		if (platform.type === "genshin") {
			const resin = weeklies.resinDiscount;
			const limit = weeklies.resinDiscountLimit;

			if (resin !== 0) {
				message.push(t `- **Resin Discount**: ${resin}/${limit} Available`);
			}
		}
		if (platform.type === "starrail") {
			const bossCompleted = (weeklies.weeklyBoss === 0);
			const simCompleted = (weeklies.rogueScore === weeklies.maxScore);
			const divergent = (weeklies.tournScore === weeklies.tournMaxScore && weeklies.tournUnlocked);
			if (bossCompleted && simCompleted && divergent) {
				return;
			}

			if (!bossCompleted) {
				message.push(t `- **Weekly Boss**: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit} Completed`);
			}
			if (!simCompleted) {
				message.push(t `- **Simulated Universe**: ${weeklies.rogueScore}/${weeklies.maxScore}`);
			}
			if (!divergent) {
				message.push(t `- **Divergent Universe**: ${weeklies.tournScore}/${weeklies.tournMaxScore}`);
			}
		}
		if (platform.type === "nap") {
			const bountiesCompleted = (weeklies.bounty === weeklies.bountyTotal);
			const surveyCompleted = (weeklies.surveyPoints === weeklies.surveyPointsTotal);
			if (bountiesCompleted && surveyCompleted) {
				return;
			}

			if (!bountiesCompleted) {
				message.push(t `- **Bounty Commission**: ${weeklies.bounty}/${weeklies.bountyTotal}`);
			}
			if (!surveyCompleted) {
				message.push(t `- **Survey Points**: ${weeklies.surveyPoints}/${weeklies.surveyPointsTotal}`);
			}
		}

		const escapedMessage = app.Utils.escapeCharacters(message.join("\n"));
		for (const telegram of telegrams) {
			await telegram.send(escapedMessage);
		}
	}
});

module.exports = {
	name: "weeklies-reminder",
	expression: "*/5 * * * 0",
	description: t("Reminds you to complete your weeklies."),
	code: (async function weekliesReminder () {
		// eslint-disable-next-line object-curly-spacing
		await RegionalTaskManager.executeTasks();
	})
};
