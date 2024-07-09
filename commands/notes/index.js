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
	run: (async function notes (context, game) {
		const { interaction } = context;
		const supportedGames = app.HoyoLab.supportedGames({ blacklist: "honkai" });

		if (supportedGames.length === 0) {
			if (interaction) {
				return await interaction.reply({
					content: "There are no accounts available for checking notes.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: "There are no accounts available for checking notes."
			};
		}

		if (!game) {
			if (interaction) {
				return await interaction.reply({
					content: "Please specify a game.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: `Please specify a game. Supported games are: ${supportedGames.join(", ")}`
			};
		}

		if (game === "zenless" || game === "zzz") {
			game = "nap";
		}

		if (!supportedGames.includes(game.toLowerCase())) {
			if (interaction) {
				return await interaction.reply({
					content: "You don't have any accounts for that game.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: `Invalid game specified. Supported games are: ${supportedGames.join(", ")}`
			};
		}

		game = game.toLowerCase();

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game });
		if (accounts.length === 0) {
			if (interaction) {
				return await interaction.reply({
					content: "You don't have any accounts for that game.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: "You don't have any accounts for that game."
			};
		}

		for (const account of accounts) {
			const { stamina, expedition } = account;
			if (stamina.check === false && expedition.check === false) {
				continue;
			}

			const platform = app.HoyoLab.get(game);
			const notes = await platform.notes(account);
			if (notes.success === false) {
				continue;
			}

			if (context.platform.id === 1) {
				const region = app.Utils.formattedAccountRegion(account.region);

				const { data } = notes;
				const { stamina, dailies, weeklies, expedition, realm } = data;

				const embeds = [{
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
				}];

				if (platform.gameId === 2) {
					embeds[0].fields.push(
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
					embeds[0].fields.push(
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
					embeds[0].fields.push(
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

				await interaction.reply({ embeds, ephemeral: true });
			}
			else if (context.platform.id === 2) {
				const { data } = notes;
				const { stamina, dailies, weeklies, expedition } = data;
				const telegram = app.Platform.get(2);

				if (platform.gameId === 2) {
					const message = [
						`Current Stamina: ${stamina.currentStamina}/${stamina.maxStamina}`
						+ `\nFull in:\n${app.Utils.formatTime(stamina.recoveryTime)}`,
						"Expedition Status",
						expedition.list.map((i, idx) => `Account ${idx + 1} - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
						"Dailies",
						`${dailies.task}/${dailies.maxTask}`,
						"Weekly Boss Chance Remaining:",
						`${weeklies.resinDiscount}/${weeklies.resinDiscountLimit}`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(message);
					await telegram.send(escapedMessage);
				}
				else if (platform.gameId === 6) {
					const message = [
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

					const escapedMessage = app.Utils.escapeCharacters(message);
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
