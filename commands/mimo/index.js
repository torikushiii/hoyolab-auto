const { t } = require("../../localization/index.js");

const createEmbed = (result) => {
	const gameColors = {
		starrail: 0xBB0BB5,
		nap: 0xFF8300
	};

	const gameNames = {
		starrail: "Honkai: Star Rail",
		nap: "Zenless Zone Zero"
	};

	const fields = [];

	if (result.tasksClaimed.length > 0) {
		const totalPoints = result.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
		fields.push({
			name: t("🎯 Tasks Claimed"),
			value: result.tasksClaimed.map(t => `• ${t.name} (+${t.points})`).join("\n").slice(0, 1024) || t("None"),
			inline: false
		});
		fields.push({
			name: t("💰 Points Earned"),
			value: t `+${totalPoints} pts`,
			inline: true
		});
	}

	if (result.itemsExchanged.length > 0) {
		fields.push({
			name: t("🎁 Items Exchanged"),
			value: result.itemsExchanged.map(i => t `• ${i.name} (-${i.cost} pts)`).join("\n").slice(0, 1024),
			inline: false
		});
	}

	if (result.codesRedeemed.length > 0) {
		fields.push({
			name: t("✅ Codes Redeemed"),
			value: result.codesRedeemed.map(c => `\`${c}\``).join(", ").slice(0, 1024),
			inline: false
		});
	}

	if (result.codesObtained?.length > 0) {
		fields.push({
			name: t("🎫 Codes Obtained"),
			value: result.codesObtained.map(c => `\`${c}\``).join("\n").slice(0, 1024),
			inline: false
		});
	}

	if (result.lotteryDraws?.length > 0) {
		fields.push({
			name: t("🎰 Lottery Draws"),
			value: result.lotteryDraws.map(d => `• ${d.name}`).join("\n").slice(0, 1024),
			inline: false
		});
	}

	fields.push({
		name: t("💎 Current Points"),
		value: t `${result.points} pts`,
		inline: true
	});

	const hasActivity = result.tasksClaimed.length > 0
		|| result.itemsExchanged.length > 0
		|| result.codesRedeemed.length > 0
		|| result.lotteryDraws?.length > 0;

	return {
		color: gameColors[result.game] || 0x5865F2,
		title: t `🐾 Traveling Mimo`,
		author: {
			name: `${result.nickname} (${result.uid})`,
			icon_url: result.assets?.logo
		},
		description: hasActivity
			? t `Successfully ran Mimo automation for ${gameNames[result.game] || result.game}!`
			: t `No new activity for ${gameNames[result.game] || result.game}.`,
		fields,
		thumbnail: {
			url: result.assets?.logo
		},
		timestamp: new Date().toISOString(),
		footer: {
			text: gameNames[result.game] || result.game,
			icon_url: result.assets?.logo
		}
	};
};

module.exports = {
	name: "mimo",
	description: t("Manually run Traveling Mimo automation for all games or a specific game."),
	params: [
		{
			name: "game",
			description: t("The game you want to run Mimo for. Leave empty for all games."),
			type: "string",
			choices: [
				{ name: t("All Games"), value: "all" },
				{ name: "Honkai: Star Rail", value: "starrail" },
				{ name: "Zenless Zone Zero", value: "nap" }
			],
			required: false
		}
	],
	run: (async function mimo (context, game) {
		const { interaction } = context;

		const gameMapping = {
			zenless: "nap",
			zzz: "nap",
			hsr: "starrail"
		};

		if (game) {
			game = gameMapping[game.toLowerCase()] || game.toLowerCase();
		}

		const supportedGames = ["starrail", "nap"];
		const gamesToRun = game && game !== "all"
			? [game].filter(g => supportedGames.includes(g))
			: supportedGames;

		if (gamesToRun.length === 0) {
			const message = t("Invalid game specified. Supported games are: Star Rail, ZZZ");
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (interaction) {
			await interaction.deferReply({ ephemeral: true });
		}

		const results = [];
		const errors = [];

		for (const gameName of gamesToRun) {
			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: gameName });
			if (accounts.length === 0) {
				continue;
			}

			const gamePlatform = app.HoyoLab.get(gameName);
			if (!gamePlatform || typeof gamePlatform.mimo !== "function") {
				errors.push({ game: gameName, error: t("Mimo not supported") });
				continue;
			}

			for (const account of accounts) {
				try {
					app.Logger.info("Command:Mimo", t `Running Mimo for ${gameName} - ${account.uid}`);

					const result = await gamePlatform.mimo(account);
					if (!result.success) {
						errors.push({
							game: gameName,
							uid: account.uid,
							error: result.message || t("Unknown error")
						});
						continue;
					}

					results.push({
						game: gameName,
						uid: account.uid,
						nickname: account.nickname,
						...result.data
					});
				}
				catch (e) {
					app.Logger.error("Command:Mimo", {
						message: t("Mimo automation failed"),
						game: gameName,
						uid: account.uid,
						error: e.message
					});
					errors.push({
						game: gameName,
						uid: account.uid,
						error: e.message
					});
				}
			}
		}

		if (results.length === 0 && errors.length === 0) {
			const message = t("No accounts found with Mimo enabled.");
			return interaction
				? interaction.editReply({ content: message })
				: { success: false, reply: message };
		}

		const embeds = results.map(r => createEmbed(r));

		if (errors.length > 0) {
			embeds.push({
				color: 0xFF0000,
				title: t("❌ Errors"),
				description: errors.map(e => `• **${e.game}** ${e.uid ? `(${e.uid})` : ""}: ${e.error}`).join("\n").slice(0, 4096)
			});
		}

		if (interaction) {
			await interaction.editReply({ embeds: embeds.slice(0, 10) });
			return;
		}

		const summaryLines = results.map(r => {
			const gameShort = { starrail: "HSR", nap: "ZZZ" }[r.game] || r.game;
			return t `${gameShort} - ${r.nickname}: ${r.points} pts`;
		});

		return { success: true, reply: summaryLines.join("\n") };
	})
};
