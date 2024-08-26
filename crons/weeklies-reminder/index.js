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
				{ name: "Region", value: app.HoyoLab.getRegion(account.region), inline: true }
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

			if (resin !== 0) {
				embed.fields.push({
					name: "Resin Discount",
					value: `${resin}/${limit} Available`,
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
			if (!divergent) {
				embed.fields.push({
					name: "Divergent Universe",
					value: `${weeklies.tournScore}/${weeklies.tournMaxScore}`,
					inline: true
				});
			}
		}
		if (platform.type === "nap") {
			const bountiesCompleted = (weeklies.bounties === weeklies.bountyTotal);
			const surveyCompleted = (weeklies.surveyPoints === weeklies.surveyPointsTotal);
			if (bountiesCompleted && surveyCompleted) {
				return;
			}

			if (!bountiesCompleted) {
				embed.fields.push({
					name: "Bounty Comission",
					value: `${weeklies.bounties}/${weeklies.bountyTotal}`,
					inline: true
				});
			}
			if (!surveyCompleted) {
				embed.fields.push({
					name: "Survey Points",
					value: `${weeklies.surveyPoints}/${weeklies.surveyPointsTotal}`,
					inline: true
				});
			}
		}

		const userId = webhook.createUserMention(account.discord);
		await webhook.send(embed, {
			content: userId,
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
			`- **Region**: ${app.HoyoLab.getRegion(account.region)}`,
			"",
			"📊 **Progress**"
		];

		if (platform.type === "genshin") {
			const resin = weeklies.resinDiscount;
			const limit = weeklies.resinDiscountLimit;

			if (resin !== 0) {
				message.push(`- **Resin Discount**: ${resin}/${limit} Available`);
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
				message.push(`- **Weekly Boss**: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit} Completed`);
			}
			if (!simCompleted) {
				message.push(`- **Simulated Universe**: ${weeklies.rogueScore}/${weeklies.maxScore}`);
			}
			if (!divergent) {
				message.push(`- **Divergent Universe**: ${weeklies.tournScore}/${weeklies.tournMaxScore}`);
			}
		}
		if (platform.type === "nap") {
			const bountiesCompleted = (weeklies.bounties === weeklies.bountyTotal);
			const surveyCompleted = (weeklies.surveyPoints === weeklies.surveyPointsTotal);
			if (bountiesCompleted && surveyCompleted) {
				return;
			}

			if (!bountiesCompleted) {
				message.push(`- **Bounty Comission**: ${weeklies.bounties}/${weeklies.bountyTotal}`);
			}
			if (!surveyCompleted) {
				message.push(`- **Survey Points**: ${weeklies.surveyPoints}/${weeklies.surveyPointsTotal}`);
			}
		}

		const escapedMessage = app.Utils.escapeCharacters(message.join("\n"));
		await telegram.send(escapedMessage);
	}
});

module.exports = {
	name: "weeklies-reminder",
	expression: "*/5 * * * 0",
	description: "Reminds you to complete your weeklies.",
	code: (async function weekliesReminder () {
		// eslint-disable-next-line object-curly-spacing
		await RegionalTaskManager.executeTasks({ blacklist: ["honkai", "nap", "tot"] });
	})
};
