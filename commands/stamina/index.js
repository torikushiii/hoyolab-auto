module.exports = {
	name: "stamina",
	description: "Check your specified game stamina",
	params: [
		{
			name: "game",
			description: "The game you want to check stamina for.",
			type: "string",
			choices: [
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai: Star Rail", value: "starrail" },
				{ name: "Zenless Zone Zero", value: "nap" }
			],
			required: true
		}
	],
	run: (async function stamina (context, game) {
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

		const data = [];
		for (const account of accounts) {
			if (account.stamina.check === false) {
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
				...notes.data.stamina
			});
		}

		if (data.length === 0) {
			return {
				success: false,
				reply: "No stamina data found for this type of account"
			};
		}

		if (context.platform.id === 1) {
			const discordData = {
				embeds: []
			};

			let text = "";
			for (const list of data) {
				const {
					uid,
					region,
					username,
					currentStamina,
					maxStamina,
					recoveryTime,
					reserveStamina
				} = list;

				const delta = app.Utils.formatTime(recoveryTime);
				const fixedRegion = app.Utils.formattedAccountRegion(region);

				const description = [
					`\n\`\`\`yaml\n${username} (${uid}) - ${fixedRegion}\`\`\``,
					`Current: ${currentStamina}/${maxStamina}`,
					`Recovery Time: ${delta}`
				];

				if (reserveStamina !== null && typeof reserveStamina !== "undefined") {
					description.push(`Reserve Stamina: ${reserveStamina}`);
				}

				text += `${description.join("\n")}\n\n`;
			}

			discordData.embeds.push({
				title: "Stamina",
				description: text
			});

			if (interaction) {
				return await interaction.reply({
					embeds: discordData.embeds,
					ephemeral: true
				});
			}
		}

		let text = "";
		for (const list of data) {
			const {
				uid,
				region,
				username,
				currentStamina,
				maxStamina,
				recoveryTime,
				reserveStamina
			} = list;

			const delta = app.Utils.formatTime(recoveryTime);
			const fixedRegion = app.Utils.formattedAccountRegion(region);

			const description = [
				`\n${username} (${uid}) - ${fixedRegion}`,
				`Current: ${currentStamina}/${maxStamina}`,
				`Recovery Time: ${delta}`
			];

			if (reserveStamina !== null && typeof reserveStamina !== "undefined") {
				description.push(`Reserve Stamina: ${reserveStamina}`);
			}

			text += `${description.join("\n")}\n\n`;
		}

		return {
			success: true,
			reply: text
		};
	})
};
