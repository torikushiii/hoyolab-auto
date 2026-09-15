const RegionalTaskManager = new app.RegionalTaskManager();

RegionalTaskManager.registerTask("HowlScratchCard", 21, 0, async (account) => {
	if (account.dailyLotteryCheck === false) {
		return;
	}

	const platform = app.HoyoLab.get(account.platform);
	const notes = await platform.notes(account);
	if (notes.success === false) {
		return;
	}

	const { data } = notes;
	const scratchCard = data.cardSign;
	if (scratchCard === "Completed") {
		return;
	}

	const platforms = app.Platform.getForAccount(account);
	const region = app.HoyoLab.getRegion(account.region);
	const embed = {
		color: data.assets.color,
		title: "ZZZ Daily Lottery",
		author: {
			name: `${region} Server - ${account.nickname}`,
			icon_url: data.assets.logo
		},
		description: "You haven't claimed your daily lottery reward yet!",
		thumbnail: {
			url: data.assets.logo
		},
		timestamp: new Date(),
		footer: {
			text: "ZZZ Daily Lottery",
			icon_url: data.assets.logo
		}
	};

	for (const webhook of platforms.filter(p => p.name === "webhook")) {
		const userId = webhook.createUserMention(account.discord);
		await webhook.send(embed, {
			content: userId,
			author: data.assets.author,
			icon: data.assets.logo
		});
	}

	const messageText = [
		`${region} Server - ${account.nickname}`,
		"🎲 ZZZ Daily Lottery",
		"You haven't claimed your daily lottery reward yet!"
	].join("\n");

	const escapedMessage = app.Utils.escapeCharacters(messageText);
	for (const telegram of platforms.filter(p => p.name === "telegram")) {
		await telegram.send(escapedMessage);
	}
});

module.exports = {
	name: "howl-scratch-card",
	expression: "*/5 * * * *",
	description: "Reminds you if you haven't claimed the ZZZ daily lottery reward.",
	code: (async function howlScratchCard () {
		await RegionalTaskManager.executeTasks({ whitelist: "nap" });
	})
};
