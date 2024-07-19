const createEmbed = (type, diary, options = {}) => {
	const account = options.account;
	const platform = options.platform;

	const { data } = diary;
	const currentMonth = data.currentMonth;
	const lastMonth = data.lastMonth;

	if (type === "genshin") {
		const embeds = [
			{
				title: `**${account.nickname}**'s Diary`,
				color: data.assets.color,
				author: {
					name: data.assets.author,
					icon_url: data.assets.logo
				},
				thumbnail: {
					url: data.assets.logo
				},
				description: `Primo income is decreased by ${data.primoIncomeDecreasePercentage}% compared to last month.`,
				fields: [
					{
						name: "**Obtained This Month**",
						value: `Primos: ${currentMonth.primo.totalNum}\nMora: ${currentMonth.mora}`,
						inline: true
					},
					{
						name: "\u200b",
						value: "\u200b",
						inline: true
					},
					{
						name: "**Obtained Last Month**",
						value: `Primos: ${lastMonth.primo.totalNum}\nMora: ${lastMonth.mora}`,
						inline: true
					},
					{
						name: "**Current Month\nBreakdown**",
						value: currentMonth.primo.actionPercentages.map(item => `${item.category}: ${item.total} (${item.percentage}%)`).join("\n"),
						inline: true
					},
					{
						name: "\u200b",
						value: "\u200b",
						inline: true
					},
					{
						name: "**Last Month\nBreakdown**",
						value: lastMonth.primo.actionPercentages.map(item => `${item.category}: ${item.total} (${item.percentage}%)`).join("\n"),
						inline: true
					}
				],
				timestamp: new Date(),
				footer: {
					text: `HoyoLab Diary - ${platform.fullName}`,
					icon_url: data.assets.logo
				}
			}
		];

		return embeds;
	}
	else if (type === "starrail") {
		const embeds = [
			{
				title: `**${account.nickname}**'s Diary`,
				color: data.assets.color,
				author: {
					name: data.assets.author,
					icon_url: data.assets.logo
				},
				thumbnail: {
					url: data.assets.logo
				},
				description: `Jades income is decreased by ${data.jadeIncomeDecreasePercentage}% compared to last month.`,
				fields: [
					{
						name: "**Obtained This Month**",
						value: `Jades: ${currentMonth.jades.totalNum}\nPass: ${currentMonth.pass}`,
						inline: true
					},
					{
						name: "\u200b",
						value: "\u200b",
						inline: true
					},
					{
						name: "**Obtained Last Month**",
						value: `Jades: ${lastMonth.jades.totalNum}\nPass: ${lastMonth.pass}`,
						inline: true
					},
					{
						name: "**Current Month\nBreakdown**",
						value: currentMonth.jades.actionPercentages.map(item => `${item.category}: ${item.total} (${item.percentage}%)`).join("\n"),
						inline: true
					},
					{
						name: "\u200b",
						value: "\u200b",
						inline: true
					},
					{
						name: "**Last Month\nBreakdown**",
						value: lastMonth.jades.actionPercentages.map(item => `${item.category}: ${item.total} (${item.percentage}%)`).join("\n"),
						inline: true
					}
				],
				timestamp: new Date(),
				footer: {
					text: `HoyoLab Diary - ${platform.fullName}`,
					icon_url: data.assets.logo
				}
			}
		];

		return embeds;
	}
};

module.exports = {
	name: "diary",
	description: "Check your total amount of incoming monthly resources.",
	params: [
		{
			name: "game",
			description: "The game you want to check diary for.",
			type: "string",
			choices: [
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai: Star Rail", value: "starrail" }
			],
			required: true
		},
		{
			name: "account",
			description: "Select the account you want to check diary for.",
			type: "string",
			required: true,
			accounts: true
		}
	],
	run: (async function notes (context, game, uid) {
		const { interaction } = context;

		const account = app.HoyoLab.getAccountById(uid);
		if (account.platform !== game) {
			return interaction.reply({ content: "This account does not belong to the selected game.", ephemeral: true });
		}

		const platform = app.HoyoLab.get(account.platform);

		await interaction.deferReply({ ephemeral: true });

		const diary = await platform.diary(account);
		if (diary.success === false) {
			return interaction.editReply({ content: "Something went wrong.", ephemeral: true });
		}

		const embedData = createEmbed(account.platform, diary, { account, platform });
		await interaction.editReply({ embeds: embedData, ephemeral: true });
	})
};
