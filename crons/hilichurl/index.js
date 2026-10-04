const { t } = require("../../localization/index.js");

const { setTimeout: sleep } = require("node:timers/promises");
const config = require("../../config.js");

module.exports = {
	name: "hilichurl",
	expression: "0 0 11 * * *",
	description: t("This will run the Hilichurl Machine Workshop automation for Genshin Impact - completing tasks, claiming rewards, and exchanging for Primogems."),
	code: (async function hilichurl () {
		const jitterSeconds = config.crons?.hilichurlJitter ?? 0;
		if (jitterSeconds > 0) {
			const jitterMs = Math.floor(Math.random() * jitterSeconds * 1000);
			app.Logger.info("Cron:Hilichurl", t `Applying ${(jitterMs / 1000).toFixed(1)}s jitter before starting...`);
			await sleep(jitterMs);
		}

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "genshin" });
		if (accounts.length === 0) {
			app.Logger.debug("Cron:Hilichurl", t("No active Genshin accounts found"));
			return;
		}

		const platform = app.HoyoLab.get("genshin");
		if (!platform || typeof platform.hilichurl !== "function") {
			app.Logger.warn("Cron:Hilichurl", t("Hilichurl method not found on Genshin platform"));
			return;
		}

		for (const account of accounts) {
			if (account.hilichurl?.check === false) {
				app.Logger.debug("Cron:Hilichurl", t `(${account.uid}) Hilichurl check disabled, skipping`);
				continue;
			}

			app.Logger.info("Cron:Hilichurl", t `(${account.uid}) Running Hilichurl automation...`);

			try {
				const result = await platform.hilichurl(account);
				if (!result.success) {
					app.Logger.warn("Cron:Hilichurl", {
						message: t("Hilichurl automation failed"),
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
					app.Logger.debug("Cron:Hilichurl", t `(${account.uid}) Genshin Impact: No new Hilichurl activity.`);
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

					if (data.freeItemsClaimed?.length > 0) {
						fields.push({
							name: t("🆓 Free Items Claimed"),
							value: data.freeItemsClaimed.map(i => `• ${i}`).join("\n").slice(0, 1024),
							inline: false
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

					fields.push({
						name: t("💎 Current Points"),
						value: t `${data.points} pts`,
						inline: true
					});

					const currencyItem = data.shopStatus.find(i => i.name.toLowerCase().includes("primogem"));
					if (currencyItem && currencyItem.nextRefreshTime > 0) {
						const restockDate = new Date(Date.now() + (currencyItem.nextRefreshTime * 1000));
						fields.push({
							name: t("⏰ Next Primogem Restock"),
							value: `<t:${Math.floor(restockDate.getTime() / 1000)}:R>`,
							inline: true
						});
					}

					const embed = {
						color: data.assets.color,
						title: t("🔧 Hilichurl Machine Workshop - Genshin Impact"),
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
							text: t("Hilichurl Workshop Automation"),
							icon_url: data.assets.logo
						}
					};

					const hasSignificantActivity = data.freeItemsClaimed?.length > 0
						|| data.itemsExchanged.length > 0
						|| data.codesRedeemed.length > 0
						|| data.codesObtained?.length > 0;

					for (const destination of embedPlatforms) {
						const userId = hasSignificantActivity
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
						t("🔧 *Hilichurl Machine Workshop* - Genshin Impact"),
						t `Region: ${region} | UID: ${account.uid}`,
						t `Player: ${account.nickname}`,
						""
					];

					if (data.tasksClaimed.length > 0) {
						const totalPoints = data.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
						lines.push(t `🎯 Tasks Claimed: ${data.tasksClaimed.length} (+${totalPoints} pts)`);
					}

					if (data.freeItemsClaimed?.length > 0) {
						lines.push(t `🆓 Free Items: ${data.freeItemsClaimed.length} claimed`);
					}

					if (data.itemsExchanged.length > 0) {
						lines.push(t `🎁 Items Exchanged: ${data.itemsExchanged.map(i => i.name).join(", ")}`);
					}

					if (data.codesRedeemed.length > 0) {
						lines.push(t `✅ Codes Redeemed: ${data.codesRedeemed.join(", ")}`);
					}

					if (data.codesObtained?.length > 0) {
						lines.push(t("🎫 Codes Obtained (Not Auto-Redeemed):"));
						for (const c of data.codesObtained) {
							lines.push(`  \`${c}\``);
						}
					}

					lines.push(t `💎 Current Points: ${data.points}`);

					const escapedMessage = app.Utils.escapeCharacters(lines.join("\n"));
					for (const telegram of telegrams) {
						await telegram.send(escapedMessage);
					}
				}

				app.Logger.info("Cron:Hilichurl", t `(${account.uid}) Genshin Impact: Hilichurl automation completed.`);
			}
			catch (e) {
				app.Logger.error("Cron:Hilichurl", {
					message: t("Error running Hilichurl automation"),
					uid: account.uid,
					error: e.message
				});
			}
		}
	})
};
