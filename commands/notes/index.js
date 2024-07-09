const getNotesEmbedData = async (accounts, game, platformId) => {
	const embedData = [];
	for (const account of accounts) {
		const { stamina, expedition } = account;
		if (!stamina.check && !expedition.check) {
			continue;
		}

		const platform = app.HoyoLab.get(game);
		const notes = await platform.notes(account);
		if (notes.success === false) {
			continue;
		}

		if (platformId === 1) {
			const region = app.Utils.formattedAccountRegion(account.region);
			const { data } = notes;
			const { stamina, dailies, weeklies, expedition, realm } = data;

			const embed = {
				color: data.assets.color,
				author: {
					name: `${region} Server - ${account.nickname}`,
					icon_url: data.assets.logo
				},
				fields: [
					{
						name: `Current Stamina:`,
						value: `${stamina.currentStamina}/${stamina.maxStamina}`
						+ `\nFull in:\n${app.Utils.formatTime(stamina.recoveryTime)}`,
						inline: true
					}
				],
				timestamp: new Date(),
				footer: {
					text: `HoyoLab Notes - ${platform.fullName}`,
					icon_url: data.assets.logo
				}
			};

			if (platform.gameId === 2) {
				embed.fields.push(
					{
						name: "Dailies",
						value: `${dailies.task}/${dailies.maxTask}`,
						inline: true
					},
					{
						name: "Weekly Boss:",
						value: `${weeklies.resinDiscount}/${weeklies.resinDiscountLimit}`,
						inline: true
					},
					{
						name: "Realm Currency",
						value: `${realm.currentCoin}/${realm.maxCoin}`
						+ `\nCapped in: ${app.Utils.formatTime(realm.recoveryTime)}`,
						inline: true
					},
					{
						name: "Expedition Status",
						value: expedition.list.map((i, idx) => `**Account ${idx + 1}** - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
						inline: true
					}
				);
			}
			else if (platform.gameId === 6) {
				embed.fields.push(
					{
						name: "Dailies",
						value: `${dailies.task}/${dailies.maxTask}`,
						inline: true
					},
					{
						name: "Weekly Status:",
						value: `Boss: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit}`
						+ `\nSimulated Universe: ${weeklies.rogueScore}/${weeklies.maxScore}`,
						inline: false
					},
					{
						name: "Expedition Status",
						value: expedition.list.map((i, idx) => `**Account ${idx + 1}** - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
						inline: true
					}
				);
			}
			else if (platform.gameId === 8) {
				embed.fields.push(
					{
						name: "Dailies",
						value: `${dailies.task}/${dailies.maxTask}`,
						inline: true
					},
					{
						name: "Shop Status",
						value: data.shop.state,
						inline: true
					},
					{
						name: "Scratch Card",
						value: data.cardSign,
						inline: true
					}
				);
			}

			embedData.push(embed);
		}
		else if (platformId === 2) {
			const { data } = notes;
			const { stamina, dailies, weeklies, expedition } = data;
			const telegram = app.Platform.get(2);

			let message = "";
			if (platform.gameId === 2) {
				message = [
					`Current Stamina: ${stamina.currentStamina}/${stamina.maxStamina}`
					+ `\nFull in:\n${app.Utils.formatTime(stamina.recoveryTime)}`,
					"Expedition Status",
					expedition.list.map((i, idx) => `Account ${idx + 1} - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
					"Dailies",
					`${dailies.task}/${dailies.maxTask}`,
					"Weekly Boss Chance Remaining:",
					`${weeklies.resinDiscount}/${weeklies.resinDiscountLimit}`
				].join("\n");
			}
			else if (platform.gameId === 6) {
				message = [
					`Current Stamina: ${stamina.currentStamina}/${stamina.maxStamina}`
					+ `\nFull in:\n${app.Utils.formatTime(stamina.recoveryTime)}`,
					"Expedition Status",
					expedition.list.map((i, idx) => `Account ${idx + 1} - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
					"Dailies",
					`${dailies.task}/${dailies.maxTask}`,
					"Weekly Status:",
					`Boss: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit}`
					+ `\nSimulated Universe: ${weeklies.rogueScore}/${weeklies.maxScore}`
				].join("\n");
			}
			else if (platform.gameId === 8) {
				message = [
					`Current Stamina: ${stamina.currentStamina}/${stamina.maxStamina}`
					+ `\nFull in:\n${app.Utils.formatTime(stamina.recoveryTime)}`,
					"Dailies",
					`${dailies.task}/${dailies.maxTask}`,
					"Shop Status",
					data.shop.state,
					"Scratch Card",
					data.cardSign
				].join("\n");
			}

			const escapedMessage = app.Utils.escapeCharacters(message);
			await telegram.send(escapedMessage);
		}
	}

	return embedData;
};

module.exports = {
	name: "notes",
	description: "Check your HoyoLab notes.",
	params: [
		{
			name: "game",
			description: "The game you want to check notes for.",
			type: "string",
			choices: [
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai: Star Rail", value: "starrail" },
				{ name: "Zenless Zone Zero", value: "nap" }
			],
			required: true
		}
	],
	run: async (context, game) => {
		const { interaction } = context;

		const supportedGames = app.HoyoLab.supportedGames({ blacklist: "honkai" });

		if (supportedGames.length === 0) {
			const message = "There are no accounts available for checking notes.";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (!game) {
			const message = `Please specify a game. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		game = game.toLowerCase() === "zenless" || game.toLowerCase() === "zzz" ? "nap" : game.toLowerCase();

		if (!supportedGames.includes(game)) {
			const message = `Invalid game specified. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game });
		if (accounts.length === 0) {
			const message = "You don't have any accounts for that game.";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		const embedData = await getNotesEmbedData(accounts, game, context.platform.id);

		if (interaction) {
			await interaction.reply({ embeds: embedData, ephemeral: true });
		}
	}
};
