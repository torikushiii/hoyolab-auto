module.exports = {
	name: "expedition",
	description: "Check the status of your expedition.",
	params: null,
	run: (async function expedition (context, game) {
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
			return {
				success: false,
				reply: "No expedition data found for this type of account"
			};
		}

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

				await context.channel.send({ embeds });
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
