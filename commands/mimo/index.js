module.exports = {
	name: "mimo",
	description: "Manually run Traveling Mimo automation for all games or a specific game.",
	params: [
		{
			name: "game",
			description: "The game you want to run Mimo for. Leave empty for all games.",
			type: "string",
			choices: [
				{ name: "All Games", value: "all" },
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
			const message = "Invalid game specified. Supported games are: Star Rail, ZZZ";
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
				errors.push({ game: gameName, error: "Mimo not supported" });
				continue;
			}

			for (const account of accounts) {
				try {
					app.Logger.info("Command:Mimo", `Running Mimo for ${gameName} - ${account.uid}`);

					const result = await gamePlatform.mimo(account);
					if (!result.success) {
						errors.push({
							game: gameName,
							uid: account.uid,
							error: result.message || "Unknown error"
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
						message: "Mimo automation failed",
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
			const message = "No accounts found with Mimo enabled.";
			return interaction
				? interaction.editReply({ content: message })
				: { success: false, reply: message };
		}

		// Build response
		const summaryLines = ["🐾 **Traveling Mimo Results**\n"];

		for (const r of results) {
			const gameShort = { genshin: "GI", starrail: "HSR", nap: "ZZZ" }[r.game] || r.game;
			summaryLines.push(`**${gameShort}** - ${r.nickname} (${r.uid})`);

			if (r.tasksClaimed.length > 0) {
				const totalPoints = r.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
				summaryLines.push(`  🎯 Tasks Claimed: ${r.tasksClaimed.length} (+${totalPoints} pts)`);
			}

			if (r.tasksFinished.length > 0) {
				summaryLines.push(`  ✅ Tasks Finished: ${r.tasksFinished.length}`);
			}

			if (r.itemsExchanged.length > 0) {
				summaryLines.push(`  🎁 Items Exchanged: ${r.itemsExchanged.map(i => i.name).join(", ")}`);
			}

			if (r.codesRedeemed.length > 0) {
				summaryLines.push(`  🔑 Codes Redeemed: ${r.codesRedeemed.join(", ")}`);
			}

			summaryLines.push(`  💎 Current Points: ${r.points}`, "");
		}

		if (errors.length > 0) {
			summaryLines.push("**❌ Errors:**");
			for (const e of errors) {
				summaryLines.push(`  • ${e.game} ${e.uid ? `(${e.uid})` : ""}: ${e.error}`);
			}
		}

		const summary = summaryLines.join("\n").slice(0, 2000);

		if (interaction) {
			await interaction.editReply({ content: summary });
			return;
		}

		return { success: true, reply: summary };
	})
};
