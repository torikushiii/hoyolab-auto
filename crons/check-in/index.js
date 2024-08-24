const RegionalTaskManager = new app.RegionalTaskManager();

RegionalTaskManager.registerTask("CheckIn", 0, 0, async (account) => {
	const platform = app.HoyoLab.get(account.platform);
	const execution = await platform.checkIn(account);

	if (!execution) {
		app.Logger.error("RegionalTaskManager:CheckIn", `Failed to execute check-in for account ${account.uid} in region ${account.region}`);
		return;
	}

	const message = execution;
	const webhook = app.Platform.get(3);
	if (webhook) {
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
				text: "HoyoLab Auto Check-In",
				icon_url: message.assets.logo
			}
		};

		await webhook.send(embed, {
			author: message.assets.author,
			icon: message.assets.logo
		});
	}

	const telegram = app.Platform.get(2);
	if (telegram) {
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
		await telegram.send(escapedMessage);
	}
});

module.exports = {
	name: "check-in",
	expression: "*/5 * * * *",
	description: "Run daily check-in every day at midnight or your specified time",
	code: (async function checkIn () {
		await RegionalTaskManager.executeTasks();
	})
};
