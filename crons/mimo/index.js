const { setTimeout: sleep } = require("node:timers/promises");
const config = require("../../config.js");

module.exports = {
	name: "mimo",
	expression: "0 0 */6 * * *",
	description: "This will run the Traveling Mimo automation for supported games (Star Rail, ZZZ) - completing tasks, claiming rewards, and exchanging for premium currency.",
	code: (async function mimo () {
		const jitterSeconds = config.crons?.mimoJitter ?? 0;
		if (jitterSeconds > 0) {
			const jitterMs = Math.floor(Math.random() * jitterSeconds * 1000);
			app.Logger.info("Cron:Mimo", `Applying ${(jitterMs / 1000).toFixed(1)}s jitter before starting...`);
			await sleep(jitterMs);
		}

		// Note: Genshin uses a different API structure (/qiuqiu/) and is not supported yet
		const supportedGames = ["starrail", "nap"];

		for (const gameName of supportedGames) {
			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: gameName });
			if (accounts.length === 0) {
				continue;
			}

			const platform = app.HoyoLab.get(gameName);
			if (!platform || typeof platform.mimo !== "function") {
				continue;
			}

			for (const account of accounts) {
				if (account.mimo?.check === false) {
					continue;
				}

				try {
					const result = await platform.mimo(account);
					if (!result.success) {
						app.Logger.warn("Cron:Mimo", {
							message: "Mimo automation failed",
							game: gameName,
							uid: account.uid,
							error: result.message
						});
						continue;
					}

					const { data } = result;

					const hasActivity = data.tasksClaimed.length > 0
						|| data.itemsExchanged.length > 0
						|| data.codesRedeemed.length > 0
						|| data.codesObtained?.length > 0
						|| data.lotteryDraws?.length > 0;

					if (!hasActivity) {
						app.Logger.debug("Cron:Mimo", `(${account.uid}) ${account.game.short}: No new Mimo activity.`);
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

						if (data.lotteryDraws?.length > 0) {
							fields.push({
								name: "🎰 Lottery Draws",
								value: data.lotteryDraws.map(d => `• ${d.name}`).join("\n").slice(0, 1024),
								inline: false
							});
						}

						fields.push({
							name: "💎 Current Points",
							value: `${data.points} pts`,
							inline: true
						});

						const currencyItem = data.shopStatus.find(i => {
							const name = i.name.toLowerCase();
							return name.includes("primogem")
								|| name.includes("stellar jade")
								|| name.includes("polychrome");
						});

						if (currencyItem && currencyItem.nextRefreshTime > 0) {
							const restockDate = new Date(Date.now() + (currencyItem.nextRefreshTime * 1000));
							fields.push({
								name: "⏰ Next Currency Restock",
								value: `<t:${Math.floor(restockDate.getTime() / 1000)}:R>`,
								inline: true
							});
						}

						const embed = {
							color: data.assets.color,
							title: `🐾 Traveling Mimo - ${account.game.name}`,
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
								text: "Traveling Mimo Automation",
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
							`🐾 *Traveling Mimo* - ${account.game.name}`,
							`Region: ${region} | UID: ${account.uid}`,
							`Player: ${account.nickname}`,
							""
						];

						if (data.tasksClaimed.length > 0) {
							const totalPoints = data.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
							lines.push(`🎯 Tasks Claimed: ${data.tasksClaimed.length} (+${totalPoints} pts)`);
						}

						if (data.itemsExchanged.length > 0) {
							lines.push(`🎁 Items Exchanged: ${data.itemsExchanged.map(i => i.name).join(", ")}`);
						}

						if (data.codesRedeemed.length > 0) {
							lines.push(`✅ Codes Redeemed: ${data.codesRedeemed.join(", ")}`);
						}

						if (data.codesObtained?.length > 0) {
							lines.push(`🎫 Codes Obtained (Not Auto-Redeemed):`);
							for (const c of data.codesObtained) {
								lines.push(`  \`${c}\``);
							}
						}

						if (data.lotteryDraws?.length > 0) { lines.push(`🎰 Lottery Draws: ${data.lotteryDraws.map(d => d.name).join(", ")}`); }
						lines.push(`💎 Current Points: ${data.points}`);

						const escapedMessage = app.Utils.escapeCharacters(lines.join("\n"));
						await telegram.send(escapedMessage);
					}

					app.Logger.info("Cron:Mimo", `(${account.uid}) ${account.game.short}: Mimo automation completed.`);
				}
				catch (e) {
					app.Logger.error("Cron:Mimo", {
						message: "Error running Mimo automation",
						game: gameName,
						uid: account.uid,
						error: e.message
					});
				}
			}
		}
	})
};
