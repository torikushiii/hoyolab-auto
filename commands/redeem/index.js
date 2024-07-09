module.exports = {
	name: "redeem",
	description: "Redeem provided codes for the specified game.",
	params: [
		{
			name: "game",
			description: "The game you want to redeem codes for.",
			type: "string",
			choices: [
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai: Star Rail", value: "starrail" },
				{ name: "Zenless Zone Zero", value: "nap" }
			],
			required: true
		},
		{
			name: "codes",
			description: "The codes you want to redeem.",
			type: "string",
			required: true
		}
	],
	run: (async function redeem (context, game, ...codes) {
		const { interaction } = context;
		const supportedGames = app.HoyoLab.supportedGames({ blacklist: "honkai" });

		if (supportedGames.length === 0) {
			if (interaction) {
				return await interaction.reply({
					content: "There are no accounts available for redeeming codes.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: "There are no accounts available for redeeming codes."
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
				reply: `No game provided. Supported games are: ${supportedGames.join(", ")}`
			};
		}
		if (codes.length === 0) {
			return {
				success: false,
				reply: "No codes provided."
			};
		}

		if (game === "zenless" || game === "zzz") {
			game = "nap";
		}

		codes = codes.map(code => code.toUpperCase());

		if (interaction) {
			await interaction.deferReply();
		}

		const res = await app.HoyoLab.redeemCode(game, codes);
		if (!res.success) {
			if (interaction) {
				return interaction.editReply({
					content: res.reply,
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: res.reply
			};
		}

		let reply = "";
		if (res.success.length > 0) {
			reply += "**Successfully redeemed codes:**\n";
			reply += `\`\`\`\n${res.success.map(i => `(${i.uid}) ${i.nick} - ${i.code}`).join("\n")}\`\`\``;
		}

		if (res.failed.length > 0) {
			reply += "\n**Failed Code Redemption(s):**\n";
			reply += `\`\`\`\n${res.failed.map(i => `(${i.uid}) ${i.nick} - ${i.code} ${i.reason}`).join("\n")}\`\`\``;
		}

		if (interaction) {
			return await interaction.editReply(reply);
		}

		return {
			success: true,
			reply
		};
	})
};
