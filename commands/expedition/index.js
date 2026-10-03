const { t, formatStatus } = require("../../localization/index.js");

const getExpeditionEmbedData = async (accounts, game, platformId) => {
	const data = [];
	for (const account of accounts) {
		if (!account.expedition.check) {
			continue;
		}

		const platform = app.HoyoLab.get(game);
		const notes = await platform.notes(account);
		if (notes.success === false) {
			continue;
		}

		data.push({
			uid: account.uid,
			region: account.region,
			username: account.nickname,
			...notes.data.expedition
		});
	}

	if (data.length === 0) {
		return [];
	}

	if (platformId === 1) {
		const embedData = [];
		for (const expedition of data) {
			const expeditionList = expedition.list.map((expedition) => ({
				name: expedition?.name ?? t("Expedition"),
				value: t `Status: ${formatStatus(expedition.status)}\nRemaining Time: ${app.Utils.formatTime(expedition.remaining_time)}`
			}));

			const embed = {
				color: 0x0099FF,
				title: t("Expedition Reminder"),
				description: t("Current expedition status"),
				fields: [
					{ name: "UID", value: expedition.uid, inline: true },
					{ name: t("Username"), value: expedition.username, inline: true },
					{ name: t("Region"), value: app.HoyoLab.getRegion(expedition.region), inline: true },
					...expeditionList
				],
				timestamp: new Date()
			};

			embedData.push(embed);
		}
		return embedData;
	}
	else {
		let reply = "";
		for (const expedition of data) {
			const expeditionList = expedition.list.map((expedition) => (
				t `${expedition?.name ?? t("Expedition")}: ${formatStatus(expedition.status)} - Remaining Time: ${app.Utils.formatTime(expedition.remaining_time)}`
			));

			reply += `${[
				t `UID: ${expedition.uid}`,
				t `Username: ${expedition.username}`,
				t `Region: ${app.HoyoLab.getRegion(expedition.region)}`,
				...expeditionList
			].join("\n")}\n`;
		}
		return reply;
	}
};

module.exports = {
	name: "expedition",
	description: t("Check the status of your expedition."),
	params: [
		{
			name: "game",
			description: t("The game you want to check expeditions for."),
			type: "string",
			choices: [
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai: Star Rail", value: "starrail" }
			],
			required: true
		}
	],
	run: (async function expedition (context, game) {
		const { interaction } = context;
		const supportedGames = app.HoyoLab.supportedGames({ blacklist: [
			"honkai",
			"tot",
			"nap"
		]});

		if (supportedGames.length === 0) {
			const message = t("There are no accounts available for checking expeditions or the game is not supported.");
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (!game) {
			const message = t `Please specify a game. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}
		if (!supportedGames.includes(game.toLowerCase())) {
			const message = t `Invalid game. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		game = game.toLowerCase();

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game });
		if (accounts.length === 0) {
			const message = t("You don't have any accounts for this game.");
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		const result = await getExpeditionEmbedData(accounts, game, context.platform.id);

		if (interaction) {
			if (result.length === 0) {
				return await interaction.reply({
					content: t("No expedition data found for this type of account."),
					ephemeral: true
				});
			}
			else {
				return await interaction.reply({
					embeds: result,
					ephemeral: true
				});
			}
		}
		else if (result === "") {
			return { success: false, reply: t("No expedition data found for this type of account") };
		}
		else {
			return { success: true, reply: result };
		}
	})
};
