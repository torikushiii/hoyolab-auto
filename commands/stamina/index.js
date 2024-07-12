const getStaminaData = async (accounts, game) => {
	const data = [];
	for (const account of accounts) {
		if (!account.stamina.check) {
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
	return data;
};

const formatStaminaMessage = (data, discord = false) => {
	let text = "";
	for (const { uid, region, username, currentStamina, maxStamina, recoveryTime, reserveStamina } of data) {
		const delta = app.Utils.formatTime(recoveryTime);
		const fixedRegion = app.HoyoLab.getRegion(region);

		const description = [
			discord ? `\n\`\`\`yaml\n${username} (${uid}) - ${fixedRegion}\`\`\`` : `\n${username} (${uid}) - ${fixedRegion}`,
			`Current: ${currentStamina}/${maxStamina}`,
			`Recovery Time: ${delta}`
		];

		if (reserveStamina !== null && typeof reserveStamina !== "undefined") {
			description.push(`Reserve Stamina: ${reserveStamina}`);
		}

		text += `${description.join("\n")}\n\n`;
	}
	return text;
};

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
			const message = "There are no accounts available for checking stamina.";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (!game) {
			const message = `Please specify a game. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message.replace(/nap/, "zenless") };
		}

		game = game.toLowerCase() === "zenless" || game.toLowerCase() === "zzz" ? "nap" : game.toLowerCase();

		if (!supportedGames.includes(game)) {
			const message = `Invalid game specified. Supported games are: ${supportedGames.join(", ")}`;
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message.replace(/nap/, "zenless") };
		}

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game });
		if (accounts.length === 0) {
			const message = "You don't have any accounts for that game.";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message.replace(/nap/, "zenless") };
		}

		const staminaData = await getStaminaData(accounts, game);

		if (staminaData.length === 0) {
			const message = "No stamina data found for this type of account";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message.replace(/nap/, "zenless") };
		}

		if (interaction) {
			const discordData = {
				embeds: [{
					title: "Stamina",
					description: formatStaminaMessage(staminaData, true)
				}]
			};
			return await interaction.reply({ embeds: discordData.embeds, ephemeral: true });
		}
		else {
			const text = formatStaminaMessage(staminaData);
			return { success: true, reply: text };
		}
	})
};
