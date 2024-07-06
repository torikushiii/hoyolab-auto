module.exports = {
	name: "shop-status",
	expression: "0 */30 * * * *",
	description: "This will check your current shop status and will fire a notification if your shop has finished selling.",
	code: (async function shopStatus () {
		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "nap" });
		if (accounts.length === 0) {
			app.Logger.warn("Cron:ShopStatus", "No active accounts found to run shop status for.");
			return;
		}

		const platform = app.HoyoLab.get("nap");
		for (const account of accounts) {
			if (account.shopStatus === false) {
				continue;
			}

			const notes = await platform.notes(account);
			if (notes.success === false) {
				continue;
			}

			const { data } = notes;

			const shop = data.shop;
			if (shop.state === "Finished") {
				const webhook = app.Platform.get(3);

				const region = app.Utils.formattedAccountRegion(account.region);
				if (webhook) {
					const embed = {
						color: data.assets.color,
						title: "Shop Status",
						author: {
							name: `${region} Server - ${account.nickname}`,
							icon_url: data.assets.logo
						},
						description: "Your shop has finished selling videos!",
						thumbnail: {
							url: data.assets.logo
						},
						timestamp: new Date(),
						footer: {
							text: "Shop Status",
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
						`🛒 Shop Status`,
						`UID: ${account.uid} ${account.nickname}`,
						`Your shop has finished selling videos!`
					].join("\n");

					const escapedMessage = app.Utils.escapeCharacters(messageText);
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
