const { setTimeout: sleep } = require("node:timers/promises");
const config = require("../../config.js");

module.exports = {
	name: "hilichurl",
	expression: "0 0 11 * * *",
	description: "This will run the Hilichurl Machine Workshop automation for Genshin Impact - completing tasks, claiming rewards, and exchanging for Primogems.",
	code: (async function hilichurl () {
		const jitterSeconds = config.crons?.hilichurlJitter ?? 0;
		if (jitterSeconds > 0) {
			const jitterMs = Math.floor(Math.random() * jitterSeconds * 1000);
			app.Logger.info("Cron:Hilichurl", `Applying ${(jitterMs / 1000).toFixed(1)}s jitter before starting...`);
			await sleep(jitterMs);
		}

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "genshin" });
		if (accounts.length === 0) {
			app.Logger.debug("Cron:Hilichurl", "No active Genshin accounts found");
			return;
		}

		const platform = app.HoyoLab.get("genshin");
		if (!platform || typeof platform.hilichurl !== "function") {
			app.Logger.warn("Cron:Hilichurl", "Hilichurl method not found on Genshin platform");
			return;
		}

		for (const account of accounts) {
			if (account.hilichurl?.check === false) {
				app.Logger.debug("Cron:Hilichurl", `(${account.uid}) Hilichurl check disabled, skipping`);
				continue;
			}

			app.Logger.info("Cron:Hilichurl", `(${account.uid}) Running Hilichurl automation...`);

			try {
				const result = await platform.hilichurl(account);
				if (!result.success) {
					app.Logger.warn("Cron:Hilichurl", {
						message: "Hilichurl automation failed",
						uid: account.uid,
						error: result.message
					});
					continue;
				}

				const { data } = result;

				const hasActivity = data.tasksClaimed.length > 0
					|| data.freeItemsClaimed?.length > 0
					|| data.itemsExchanged.length > 0
					|| data.codesRedeemed.length > 0
					|| data.codesObtained?.length > 0;

				if (!hasActivity) {
					app.Logger.debug("Cron:Hilichurl", `(${account.uid}) Genshin Impact: No new Hilichurl activity.`);
					continue;
				}

				const region = app.HoyoLab.getRegion(account.region);
				const webhook = app.Platform.get(3);
				if (webhook) {
					const fields = [];

					if (data.tasksClaimed.length > 0) {
						const totalPoints = data.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
						fields.push({
							name: "🎯 Tasks Claimed",
							value: data.tasksClaimed.map(t => `• ${t.name} (+${t.points})`).join("\n").slice(0, 1024),
							inline: false
						}, {
							name: "💰 Points Earned",
							value: `+${totalPoints} pts`,
							inline: true
						});
					}

					if (data.freeItemsClaimed?.length > 0) {
						fields.push({
							name: "🆓 Free Items Claimed",
							value: data.freeItemsClaimed.map(i => `• ${i}`).join("\n").slice(0, 1024),
							inline: false
						});
					}

					if (data.itemsExchanged.length > 0) {
						fields.push({
							name: "🎁 Items Exchanged",
							value: data.itemsExchanged.map(i => `• ${i.name} (-${i.cost} pts)`).join("\n").slice(0, 1024),
							inline: false
						});
					}

					if (data.codesRedeemed.length > 0) {
						fields.push({
							name: "✅ Codes Redeemed",
							value: data.codesRedeemed.join(", ").slice(0, 1024),
							inline: false
						});
					}

					if (data.codesObtained?.length > 0) {
						fields.push({
							name: "🎫 Codes Obtained (Not Auto-Redeemed)",
							value: data.codesObtained.map(c => `\`${c}\``).join("\n").slice(0, 1024),
							inline: false
						});
					}

					fields.push({
						name: "💎 Current Points",
						value: `${data.points} pts`,
						inline: true
					});

					const currencyItem = data.shopStatus.find(i => i.name.toLowerCase().includes("primogem"));
					if (currencyItem && currencyItem.nextRefreshTime > 0) {
						const restockDate = new Date(Date.now() + (currencyItem.nextRefreshTime * 1000));
						fields.push({
							name: "⏰ Next Primogem Restock",
							value: `<t:${Math.floor(restockDate.getTime() / 1000)}:R>`,
							inline: true
						});
					}

					const embed = {
						color: data.assets.color,
						title: "🔧 Hilichurl Machine Workshop - Genshin Impact",
						author: {
							name: `${region} Server - ${account.nickname}`,
							icon_url: data.assets.logo
						},
						fields,
						thumbnail: {
							url: data.assets.logo
						},
						timestamp: new Date(),
						footer: {
							text: "Hilichurl Workshop Automation",
							icon_url: data.assets.logo
						}
					};

					const userId = webhook.createUserMention(account.discord);
					await webhook.send(embed, {
						content: userId,
						author: data.assets.author,
						icon: data.assets.logo
					});
				}

				const telegram = app.Platform.get(2);
				if (telegram) {
					const lines = [
						"🔧 *Hilichurl Machine Workshop* - Genshin Impact",
						`Region: ${region} | UID: ${account.uid}`,
						`Player: ${account.nickname}`,
						""
					];

					if (data.tasksClaimed.length > 0) {
						const totalPoints = data.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
						lines.push(`🎯 Tasks Claimed: ${data.tasksClaimed.length} (+${totalPoints} pts)`);
					}

					if (data.freeItemsClaimed?.length > 0) {
						lines.push(`🆓 Free Items: ${data.freeItemsClaimed.length} claimed`);
					}

					if (data.itemsExchanged.length > 0) {
						lines.push(`🎁 Items Exchanged: ${data.itemsExchanged.map(i => i.name).join(", ")}`);
					}

					if (data.codesRedeemed.length > 0) {
						lines.push(`✅ Codes Redeemed: ${data.codesRedeemed.join(", ")}`);
					}

					if (data.codesObtained?.length > 0) {
						lines.push("🎫 Codes Obtained (Not Auto-Redeemed):");
						for (const c of data.codesObtained) {
							lines.push(`  \`${c}\``);
						}
					}

					lines.push(`💎 Current Points: ${data.points}`);

					const escapedMessage = app.Utils.escapeCharacters(lines.join("\n"));
					await telegram.send(escapedMessage);
				}

				app.Logger.info("Cron:Hilichurl", `(${account.uid}) Genshin Impact: Hilichurl automation completed.`);
			}
			catch (e) {
				app.Logger.error("Cron:Hilichurl", {
					message: "Error running Hilichurl automation",
					uid: account.uid,
					error: e.message
				});
			}
		}
	})
};
