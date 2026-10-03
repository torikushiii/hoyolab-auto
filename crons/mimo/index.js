const { t } = require("../../localization/index.js");

const { setTimeout: sleep } = require("node:timers/promises");
const config = require("../../config.js");

module.exports = {
	name: "mimo",
	expression: "0 0 */6 * * *",
	description: t("This will run the Traveling Mimo automation for supported games (Star Rail, ZZZ) - completing tasks, claiming rewards, and exchanging for premium currency."),
	code: (async function mimo () {
		const jitterSeconds = config.crons?.mimoJitter ?? 0;
		if (jitterSeconds > 0) {
			const jitterMs = Math.floor(Math.random() * jitterSeconds * 1000);
			app.Logger.info("Cron:Mimo", t `Applying ${(jitterMs / 1000).toFixed(1)}s jitter before starting...`);
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
							message: t("Mimo automation failed"),
							game: gameName,
							uid: account.uid,
							error: result.message
						});

						const isCriticalError = result.message?.toLowerCase().includes("cookie")
							|| result.message?.toLowerCase().includes("expired")
							|| result.message?.toLowerCase().includes("login");

						if (isCriticalError) {
							const region = app.HoyoLab.getRegion(account.region);
							const platforms = app.Platform.getForAccount(account);
							const embed = {
								color: 0xFF0000,
								title: t `🐾 Traveling Mimo Failure - ${account.game.name}`,
								author: {
									name: t `${region} Server - ${account.nickname}`,
									icon_url: account.assets?.logo
								},
								description: t `**Automation Failed:** ${result.message}`,
								timestamp: new Date(),
								footer: {
									text: t("Traveling Mimo Automation"),
									icon_url: account.assets?.logo
								}
							};

							for (const destination of app.Platform.getEmbedPlatforms(platforms)) {
								await destination.send(embed, {
									content: destination.createUserMention(account.discord),
									author: account.assets?.author,
									icon: account.assets?.logo
								});
							}

							const failureText = [
								t `🐾 *Traveling Mimo Failure* - ${account.game.name}`,
								t `Region: ${region} | UID: ${account.uid}`,
								t `Player: ${account.nickname}`,
								"",
								t `❌ *Error:* ${result.message}`
							].join("\n");
							const escapedFailureText = app.Utils.escapeCharacters(failureText);
							for (const telegram of platforms.filter(p => p.name === "telegram")) {
								await telegram.send(escapedFailureText);
							}
						}
						continue;
					}

					const { data } = result;

					const hasActivity = data.tasksClaimed.length > 0
						|| data.itemsExchanged.length > 0
						|| data.codesRedeemed.length > 0
						|| data.codesObtained?.length > 0
						|| data.lotteryDraws?.length > 0
						|| data.errors?.length > 0;

					if (!hasActivity) {
						app.Logger.debug("Cron:Mimo", t `(${account.uid}) ${account.game.short}: No new Mimo activity.`);
						continue;
					}

					const region = app.HoyoLab.getRegion(account.region);
					const platforms = app.Platform.getForAccount(account);
					const embedPlatforms = app.Platform.getEmbedPlatforms(platforms);
					const telegrams = platforms.filter(p => p.name === "telegram");
					if (embedPlatforms.length > 0) {
						const fields = [];

						if (data.tasksClaimed.length > 0) {
							const totalPoints = data.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
							fields.push({
								name: t("🎯 Tasks Claimed"),
								value: data.tasksClaimed.map(t => `• ${t.name} (+${t.points})`).join("\n").slice(0, 1024),
								inline: false
							}, {
								name: t("💰 Points Earned"),
								value: t `+${totalPoints} pts`,
								inline: true
							});
						}

						if (data.itemsExchanged.length > 0) {
							fields.push({
								name: t("🎁 Items Exchanged"),
								value: data.itemsExchanged.map(i => t `• ${i.name} (-${i.cost} pts)`).join("\n").slice(0, 1024),
								inline: false
							});
						}

						if (data.codesRedeemed.length > 0) {
							fields.push({
								name: t("✅ Codes Redeemed"),
								value: data.codesRedeemed.join(", ").slice(0, 1024),
								inline: false
							});
						}

						if (data.codesObtained?.length > 0) {
							fields.push({
								name: t("🎫 Codes Obtained (Not Auto-Redeemed)"),
								value: data.codesObtained.map(c => `\`${c}\``).join("\n").slice(0, 1024),
								inline: false
							});
						}

						if (data.lotteryDraws?.length > 0) {
							fields.push({
								name: t("🎰 Lottery Draws"),
								value: data.lotteryDraws.map(d => `• ${d.name}`).join("\n").slice(0, 1024),
								inline: false
							});
						}

						if (data.errors?.length > 0) {
							fields.push({
								name: t("❌ Errors"),
								value: data.errors.map(e => `• ${e}`).join("\n").slice(0, 1024),
								inline: false
							});
						}

						fields.push({
							name: t("💎 Current Points"),
							value: t `${data.points} pts`,
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
								name: t("⏰ Next Currency Restock"),
								value: `<t:${Math.floor(restockDate.getTime() / 1000)}:R>`,
								inline: true
							});
						}

						const embed = {
							color: data.assets.color,
							title: t `🐾 Traveling Mimo - ${account.game.name}`,
							author: {
								name: t `${region} Server - ${account.nickname}`,
								icon_url: data.assets.logo
							},
							fields,
							thumbnail: {
								url: data.assets.logo
							},
							timestamp: new Date(),
							footer: {
								text: t("Traveling Mimo Automation"),
								icon_url: data.assets.logo
							}
						};

						const shouldMention = data.errors?.length > 0
							|| data.codesObtained?.length > 0
							|| (account.mimo?.mentionOnSuccess !== false && (
								data.itemsExchanged.length > 0
								|| data.codesRedeemed.length > 0
							));

						for (const destination of embedPlatforms) {
							const userId = shouldMention
								? destination.createUserMention(account.discord)
								: null;

							await destination.send(embed, {
								...(userId && { content: userId }),
								author: data.assets.author,
								icon: data.assets.logo
							});
						}
					}

					if (telegrams.length > 0) {
						const lines = [
							t `🐾 *Traveling Mimo* - ${account.game.name}`,
							t `Region: ${region} | UID: ${account.uid}`,
							t `Player: ${account.nickname}`,
							""
						];

						if (data.tasksClaimed.length > 0) {
							const totalPoints = data.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
							lines.push(t `🎯 Tasks Claimed: ${data.tasksClaimed.length} (+${totalPoints} pts)`);
						}

						if (data.itemsExchanged.length > 0) {
							lines.push(t `🎁 Items Exchanged: ${data.itemsExchanged.map(i => i.name).join(", ")}`);
						}

						if (data.codesRedeemed.length > 0) {
							lines.push(t `✅ Codes Redeemed: ${data.codesRedeemed.join(", ")}`);
						}

						if (data.codesObtained?.length > 0) {
							lines.push(t `🎫 Codes Obtained (Not Auto-Redeemed):`);
							for (const c of data.codesObtained) {
								lines.push(`  \`${c}\``);
							}
						}

						if (data.lotteryDraws?.length > 0) {
							lines.push(t `🎰 Lottery Draws: ${data.lotteryDraws.map(d => d.name).join(", ")}`);
						}

						if (data.errors?.length > 0) {
							lines.push(t `❌ Errors:`);
							for (const err of data.errors) {
								lines.push(`  • ${err}`);
							}
						}
						lines.push(t `💎 Current Points: ${data.points}`);

						const escapedMessage = app.Utils.escapeCharacters(lines.join("\n"));
						for (const telegram of telegrams) {
							await telegram.send(escapedMessage);
						}
					}

					app.Logger.info("Cron:Mimo", t `(${account.uid}) ${account.game.short}: Mimo automation completed.`);
				}
				catch (e) {
					app.Logger.error("Cron:Mimo", {
						message: t("Error running Mimo automation"),
						game: gameName,
						uid: account.uid,
						error: e.message
					});
				}
			}
		}
	})
};
