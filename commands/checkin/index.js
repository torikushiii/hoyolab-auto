module.exports = {
	name: "checkin",
	description: "Manually run check-in for all games or a specific game.",
	params: [
		{
			name: "game",
			description: "The game you want to check-in for. Leave empty to check-in for all games.",
			type: "string",
			choices: [
				{ name: "All Games", value: "all" },
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai Impact 3rd", value: "honkai" },
				{ name: "Honkai: Star Rail", value: "starrail" },
				{ name: "Zenless Zone Zero", value: "nap" },
				{ name: "Tears of Themis", value: "tot" }
			],
			required: false
		}
	],
	run: (async function checkin (context, game) {
		const { interaction, platform } = context;

		const gameMapping = {
			zenless: "nap",
			zzz: "nap",
			hsr: "starrail",
			hi3: "honkai"
		};

		if (game) {
			game = gameMapping[game.toLowerCase()] || game.toLowerCase();
		}

		const activeGameAccounts = game && game !== "all"
			? [game].filter(g => app.HoyoLab.get(g))
			: app.HoyoLab.getActivePlatform();

		if (activeGameAccounts.length === 0) {
			const message = "No active game accounts found.";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (interaction) {
			await interaction.deferReply({ ephemeral: true });
		}

		const results = [];
		const errors = [];

		for (const name of activeGameAccounts) {
			const gamePlatform = app.HoyoLab.get(name);
			if (!gamePlatform) {
				continue;
			}

			try {
				const execution = await gamePlatform.checkIn();
				if (execution.length === 0) {
					continue;
				}

				results.push(...execution);
			}
			catch (e) {
				app.Logger.error("Command:CheckIn", {
					message: "Check-in failed",
					game: name,
					error: e.message
				});
				errors.push({ game: name, error: e.message });
			}
		}

		if (results.length === 0 && errors.length === 0) {
			const message = "All accounts have already checked in today or no accounts found.";
			return interaction
				? interaction.editReply({ content: message })
				: { success: true, reply: message };
		}

		if (platform.id === 1) {
			const embeds = results.map((message, i) => {
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
					fields = fields.filter(f => f.name !== "Username" && f.name !== "Rank");
				}

				return {
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
						text: `Manual Check-In (${i + 1}/${results.length})`,
						icon_url: message.assets.logo
					}
				};
			});

			if (errors.length > 0) {
				embeds.push({
					color: 0xFF0000,
					title: "❌ Check-In Errors",
					description: errors.map(e => `**${e.game}**: ${e.error}`).join("\n"),
					timestamp: new Date()
				});
			}

			if (interaction) {
				await interaction.editReply({ embeds: embeds.slice(0, 10) });
			}

			const webhook = app.Platform.get(3);
			if (webhook) {
				for (const embed of embeds) {
					await webhook.send(embed, {
						author: "HoyoLab Auto",
						icon: embed.author?.icon_url
					});
				}
			}
		}
		else if (platform.id === 2) {
			const telegram = app.Platform.get(2);
			if (telegram) {
				for (const message of results) {
					const messageText = [
						`🎮 **${message.assets.game}** Manual Check-In`,
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

				if (errors.length > 0) {
					const errorText = errors.map(e => `❌ ${e.game}: ${e.error}`).join("\n");
					await telegram.send(app.Utils.escapeCharacters(errorText));
				}
			}
		}
		else {
			const summary = [];
			if (results.length > 0) {
				summary.push(`✅ Successfully checked in for ${results.length} account(s):`);
				for (const r of results) {
					summary.push(`  • ${r.assets.game}: ${r.username} - ${r.award.name} x${r.award.count}`);
				}
			}
			if (errors.length > 0) {
				summary.push(`❌ Failed for ${errors.length} game(s):`);
				for (const e of errors) {
					summary.push(`  • ${e.game}: ${e.error}`);
				}
			}

			return interaction
				? interaction.editReply({ content: summary.join("\n") })
				: { success: true, reply: summary.join("\n") };
		}

		return { success: true };
	})
};
