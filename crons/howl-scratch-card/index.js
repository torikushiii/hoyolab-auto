module.exports = {
	name: "howl-scratch-card",
	expression: "0 0 21 * * *",
	description: "Reminds you if you haven't scratched the card at Howl's News Stand.",
	code: (async function howlScratchCard () {
		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "nap" });
		if (accounts.length === 0) {
			app.Logger.warn("Cron:ScratchCard", "No active accounts found for Zenless Zone Zero.");
			return;
		}

		const platform = app.HoyoLab.get("nap");
		for (const account of accounts) {
			const notes = await platform.notes(account);
			if (notes.success === false) {
				continue;
			}

			const { data } = notes;
			const scratchCard = data.cardSign;
			if (scratchCard === "Completed") {
				continue;
			}

			const webhook = app.Platform.get(3);
			const region = app.HoyoLab.getRegion(account.region);
			if (webhook) {
				const embed = {
					color: data.assets.color,
					title: "Howl's News Stand",
					author: {
						name: `${region} Server - ${account.nickname}`,
						icon_url: data.assets.logo
					},
					description: "You haven't scratched the card at Howl's News Stand yet!",
					thumbnail: {
						url: data.assets.logo
					},
					timestamp: new Date(),
					footer: {
						text: "Howl's News Stand",
						icon_url: data.assets.logo
					}
				};

				await webhook.send(embed, {
					author: data.assets.author,
					icon: data.assets.logo
				});
			}

			const telegram = app.Platform.get(2);
			if (telegram) {
				const messageText = [
					`${region} Server - ${account.nickname}`,
					`📰 Howl's News Stand`,
					`You haven't scratched the card at Howl's News Stand yet!`
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(messageText);
				await telegram.send(escapedMessage);
			}
		}
	})
};
