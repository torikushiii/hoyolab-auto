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
			name: "account",
			description: "Select the account you want to check notes for.",
			type: "string",
			required: true,
			accounts: true
		},
		{
			name: "code",
			description: "The code you want to redeem. (Only one code per command)",
			type: "string",
			required: true
		}
	],
	run: (async function redeem (context, game, uid, code) {
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
		if (!code) {
			if (interaction) {
				return await interaction.reply({
					content: "Please specify a code.",
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: "No code provided."
			};
		}

		if (game === "zenless" || game === "zzz") {
			game = "nap";
		}

		code = code.toUpperCase();

		if (interaction) {
			await interaction.deferReply({ ephemeral: true });
		}

		const res = await app.HoyoLab.redeemCode(game, uid, code);
		if (!res.success) {
			if (interaction) {
				return interaction.editReply({
					content: `Failed to redeem code: ${res.data.reason}`,
					ephemeral: true
				});
			}

			return {
				success: false,
				reply: `Failed to redeem code: ${res.data.reason}`
			};
		}

		if (interaction) {
			return interaction.editReply(`Successfully redeemed code: ${code}`);
		}

		return {
			success: true,
			reply: `Successfully redeemed code: ${code}`
		};
	})
};
