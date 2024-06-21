module.exports = {
	name: "notes",
	description: "Check your HoyoLab notes.",
	params: null,
	run: (async function notes (context, game) {
		const validGames = app.HoyoLab.supportedGames({ blacklist: "honkai" });
		if (!game) {
			return {
				success: false,
				reply: `Please specify a game. Valid games are: ${validGames.join(", ")}`
			};
		}
		if (!validGames.includes(game.toLowerCase())) {
			return {
				success: false,
				reply: `Invalid game. Valid games are: ${validGames.join(", ")}`
			};
		}

		game = game.toLowerCase();

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game });
		if (accounts.length === 0) {
			return {
				success: false,
				reply: "No accounts found for that type of game"
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
				await context.channel.send(`${account.nickname} - Failed to fetch notes, check the logs for more information.`);
				continue;
			}

			if (context.platform.id === 1) {
				const region = app.Utils.formattedAccountRegion(account.region);

				const { data } = notes;
				const { stamina, dailies, weeklies, expedition } = data;
                
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
						},
						{
							name: "Expedition Status",
							value: expedition.list.map((i, idx) => `**Account ${idx + 1}** - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
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
							inline: false
						},
						{
							name: "Weekly Boss Chance Remaining:",
							value: `${weeklies.resinDiscount}/${weeklies.resinDiscountLimit}`,
							inline: true
						}
					);
				}
				else if (platform.gameId === 6) {
					embeds[0].fields.push(
						{
							name: "Dailies",
							value: `${dailies.task}/${dailies.maxTask}`,
							inline: false
						},
						{
							name: "Weekly Status:",
							value: `Boss: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit}`
                            + `\nSimulated Universe: ${weeklies.rogueScore}/${weeklies.maxScore}`,
							inline: true
						}
					);
				}

				await context.channel.send({ embeds });
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
