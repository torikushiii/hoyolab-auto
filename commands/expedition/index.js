module.exports = {
	name: "expedition",
	description: "Check the status of your expedition.",
	params: [
		{
			name: "game",
			description: "The game you want to check expeditions for.",
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
		const supportedGames = app.HoyoLab.supportedGames({ blacklist: "honkai" });

		if (supportedGames.length === 0) {
			if (interaction) {
				return await interaction.reply({
					content: "There are no accounts available for checking expeditions.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: "There are no accounts available for checking expeditions."
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
		if (!supportedGames.includes(game.toLowerCase())) {
			if (interaction) {
				return await interaction.reply({
					content: "You don't have any accounts for that game.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: `Invalid game. Supported games are: ${supportedGames.join(", ")}`
			};
		}

		game = game.toLowerCase();

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game });
		if (accounts.length === 0) {
			if (interaction) {
				return await interaction.reply({
					content: "You don't have any accounts for this game.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: "You don't have any accounts for this game."
			};
		}

		const data = [];
		for (const account of accounts) {
			if (account.expedition.check === false) {
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
			if (interaction) {
				return await interaction.reply({
					content: "No expedition data found for this type of account.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: "No expedition data found for this type of account"
			};
		}

		const embedData = [];
		if (context.platform.id === 1) {
			for (const expedition of data) {
				const expeditionList = expedition.list.map((expedition) => ({
					name: expedition?.name ?? "Expedition",
					value: `Status: ${expedition.status}\nRemaining Time: ${app.Utils.formatTime(expedition.remaining_time)}`
				}));

				const embeds = [{
					color: 0x0099FF,
					title: "Expedition Reminder",
					description: "Current expedition status",
					fields: [
						{ name: "UID", value: expedition.uid, inline: true },
						{ name: "Username", value: expedition.username, inline: true },
						{ name: "Region", value: app.Utils.formattedAccountRegion(expedition.region), inline: true },
						...expeditionList
					],
					timestamp: new Date()
				}];

				embedData.push(...embeds);
			}

			if (interaction) {
				return await interaction.reply({
					embeds: embedData,
					ephemeral: true
				});
			}

			return;
		}

		let reply = "";
		for (const expedition of data) {
			const expeditionList = expedition.list.map((expedition) => (
				`${expedition?.name ?? "Expedition"}: ${expedition.status} - Remaining Time: ${app.Utils.formatTime(expedition.remaining_time)}`
			));

			reply += `${[
				`UID: ${expedition.uid}`,
				`Username: ${expedition.username}`,
				`Region: ${app.Utils.formattedAccountRegion(expedition.region)}`,
				...expeditionList
			].join("\n")}\n`;
		}

		return {
			success: true,
			reply
		};
	})
};
