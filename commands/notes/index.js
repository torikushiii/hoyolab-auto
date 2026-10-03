const { t } = require("../../localization/index.js");

const getNotesEmbedData = async (accounts, game, platformId) => {
	const embedData = [];
	for (const account of accounts) {
		const { stamina, expedition } = account;
		if (!stamina.check && !expedition?.check) {
			continue;
		}

		const platform = app.HoyoLab.get(game);
		const notes = await platform.notes(account);
		if (notes.success === false) {
			continue;
		}

		if (platformId === 1) {
			const region = app.HoyoLab.getRegion(account.region);
			const { data } = notes;
			const { stamina, dailies, weeklies, expedition, realm } = data;

			const currentStamina = Math.round(stamina.currentStamina);
			const embed = {
				color: data.assets.color,
				author: {
					name: t `${region} Server - ${account.nickname}`,
					icon_url: data.assets.logo
				},
				fields: [
					{
						name: t `Current Stamina:`,
						value: `${currentStamina}/${stamina.maxStamina}`
						+ t `\nFull in:\n${app.Utils.formatTime(stamina.recoveryTime)}`,
						inline: true
					}
				],
				timestamp: new Date(),
				footer: {
					text: t `HoyoLab Notes - ${platform.fullName}`,
					icon_url: data.assets.logo
				}
			};

			if (platform.gameId === 2) {
				const { task, maxTask, storedAttendance, storedAttendanceRefresh } = dailies;

				const storedAttendanceText = t `Stored Attendance: ${storedAttendance}`;
				const refreshText = t `Refresh in: ${app.Utils.formatTime(storedAttendanceRefresh)}`;

				embed.fields.push(
					{
						name: t("Dailies"),
						value: `${task}/${maxTask}`,
						inline: true
					},
					{
						name: t("Stored Attendance"),
						value: `${storedAttendanceText}\n${refreshText}`,
						inline: true
					},
					{
						name: t("Weekly Boss:"),
						value: `${weeklies.resinDiscount}/${weeklies.resinDiscountLimit}`,
						inline: true
					},
					{
						name: t("Realm Currency"),
						value: `${realm.currentCoin}/${realm.maxCoin}`
						+ t `\nCapped in: ${app.Utils.formatTime(realm.recoveryTime)}`,
						inline: true
					},
					{
						name: t("Expedition Status"),
						value: expedition.list.map((i, idx) => t `**Account ${idx + 1}** - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
						inline: true
					}
				);
			}
			else if (platform.gameId === 6) {
				embed.fields.push(
					{
						name: t("Dailies"),
						value: `${dailies.task}/${dailies.maxTask}`,
						inline: true
					},
					{
						name: t("Weekly Status:"),
						value: t `Boss: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit}`
						+ t `\nSimulated Universe: ${weeklies.rogueScore}/${weeklies.maxScore}`,
						inline: false
					},
					{
						name: t("Expedition Status"),
						value: expedition.list.map((i, idx) => t `**Account ${idx + 1}** - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
						inline: true
					}
				);

				if (weeklies.tournUnlocked) {
					embed.fields[2].value += t `\nDivergent Universe: ${weeklies.tournScore}/${weeklies.tournMaxScore}`;
				}
			}
			else if (platform.gameId === 8) {
				embed.fields.push(
					{
						name: t("Dailies"),
						value: `${dailies.task}/${dailies.maxTask}`,
						inline: true
					},
					{
						name: t("Shop Status"),
						value: t(data.shop.state),
						inline: true
					},
					{
						name: t("Weeklies"),
						value: t `Bounty Commission: ${weeklies.bounty}/${weeklies.bountyTotal}`
						+ t `\nSurvey Points: ${weeklies.surveyPoints}/${weeklies.surveyPointsTotal}`,
						inline: true
					},
					{
						name: t("Scratch Card"),
						value: t(data.cardSign),
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
				const { task, maxTask, storedAttendance, storedAttendanceRefresh } = dailies;

				const currentStamina = Math.floor(stamina.currentStamina);
				message = [
					`${account.nickname} - ${account.uid}`,
					t `Current Stamina: ${currentStamina}/${stamina.maxStamina}`
					+ t `\nFull in: ${app.Utils.formatTime(stamina.recoveryTime)}`,
					t("Expedition Status"),
					expedition.list.map((i, idx) => t `Account ${idx + 1} - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
					t `Dailies: ${task}/${maxTask}`,
					t `Stored Attendance: ${storedAttendance}`,
					t `Refresh in: ${app.Utils.formatTime(storedAttendanceRefresh)}`,
					t `Weekly Boss Chance Remaining: ${weeklies.resinDiscount}/${weeklies.resinDiscountLimit}`
				].join("\n");
			}
			else if (platform.gameId === 6) {
				message = [
					`${account.nickname} - ${account.uid}`,
					t `Current Stamina: ${stamina.currentStamina}/${stamina.maxStamina}`
					+ t `\nFull in: ${app.Utils.formatTime(stamina.recoveryTime)}`,
					t("Expedition Status"),
					expedition.list.map((i, idx) => t `Account ${idx + 1} - ${app.Utils.formatTime(i.remaining_time)}`).join("\n"),
					t `Dailies: ${dailies.task}/${dailies.maxTask}`,
					t("Weekly Status:"),
					t `Boss: ${weeklies.weeklyBoss}/${weeklies.weeklyBossLimit}`
					+ t `\nSimulated Universe: ${weeklies.rogueScore}/${weeklies.maxScore}`
				].join("\n");

				if (weeklies.tournUnlocked) {
					message += t `\nDivergent Universe: ${weeklies.tournScore}/${weeklies.tournMaxScore}`;
				}
			}
			else if (platform.gameId === 8) {
				message = [
					`${account.nickname} - ${account.uid}`,
					t `Current Stamina: ${stamina.currentStamina}/${stamina.maxStamina}`
					+ t `\nFull in: ${app.Utils.formatTime(stamina.recoveryTime)}`,
					t `Dailies: ${dailies.task}/${dailies.maxTask}`,
					t `Bounty Commission: ${weeklies.bounty}/${weeklies.bountyTotal}`,
					t `Survey Points: ${weeklies.surveyPoints}/${weeklies.surveyPointsTotal}`,
					t `Shop Status: ${t(data.shop.state)}`,
					t `Howl Scratch Card: ${t(data.cardSign)}`
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
	description: t("Check your HoyoLab notes."),
	params: [
		{
			name: "game",
			description: t("The game you want to check notes for."),
			type: "string",
			choices: [
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai: Star Rail", value: "starrail" },
				{ name: "Zenless Zone Zero", value: "nap" }
			],
			required: true
		},
		{
			name: "account",
			description: t("Select the account you want to check notes for. If not specified, will check all accounts."),
			type: "string",
			required: false,
			accounts: true
		}
	],
	run: (async function notes (context, game, uid) {
		const { interaction } = context;

		const supportedGames = app.HoyoLab.supportedGames({ blacklist: [
			"honkai",
			"tot"
		]});

		if (supportedGames.length === 0) {
			const message = t("There are no accounts available for checking notes.");
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (!game) {
			const message = t `Please specify a game. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message.replace(/nap/, "zenless") };
		}

		game = game.toLowerCase() === "zenless" || game.toLowerCase() === "zzz" ? "nap" : game.toLowerCase();

		if (!supportedGames.includes(game)) {
			const message = t `Invalid game specified. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message.replace(/nap/, "zenless") };
		}

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game, uid });
		if (accounts.length === 0) {
			const message = t("You don't have any accounts for that game.");
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (accounts.length === 1) {
			const [account] = accounts;
			const { stamina, expedition } = account;

			if (!stamina.check && !expedition?.check) {
				const message = t("This account has no notes to check.");
				return interaction
					? interaction.reply({ content: message, ephemeral: true })
					: { success: false, reply: message };
			}
		}

		const embedData = await getNotesEmbedData(accounts, game, context.platform.id);

		if (interaction) {
			if (embedData.length === 0) {
				return interaction.reply({ content: "No notes data found for these accounts.", ephemeral: true });
			}
			await interaction.reply({ embeds: embedData, ephemeral: true });
		}
	})
};
