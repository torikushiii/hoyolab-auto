module.exports = {
	name: "stamina",
	description: "Check your specified game stamina",
	params: null,
	run: (async function stamina (context, game) {
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
				reply: `No accounts found for that type of game`
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

			return {
				success: true,
				discord: discordData
			};
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

			if (reserveStamina !== null) {
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
