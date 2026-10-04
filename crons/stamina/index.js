const { t } = require("../../localization/index.js");

module.exports = {
	name: "stamina",
	expression: "0 */30 * * * *",
	description: t("Check for your stamina and notify you when it's within the set threshold."),
	code: (async function stamina () {
		// eslint-disable-next-line object-curly-spacing
		const accountsList = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai", "tot"] });
		if (accountsList.length === 0) {
			app.Logger.warn("Cron:Stamina", t("No active accounts found to run stamina check for."));
			return;
		}

		const activeGameAccounts = app.HoyoLab.getActivePlatform();
		for (const name of activeGameAccounts) {
			const platform = app.HoyoLab.get(name);
			const accounts = accountsList.filter(account => account.platform === name);

			for (const account of accounts) {
				const staminaCheck = account.stamina.check;
				if (staminaCheck === false) {
					continue;
				}

				const notes = await platform.notes(account);
				if (notes.success === false) {
					continue;
				}

				const { data } = notes;
				const stamina = data.stamina;

				const current = Math.floor(stamina.currentStamina);
				if (current < account.stamina.threshold) {
					account.stamina.fired = false;
					platform.update(account);
					continue;
				}

				const { fired, persistent } = account.stamina;
				if (fired && !persistent) {
					continue;
				}

				const max = stamina.maxStamina;
				const delta = app.Utils.formatTime(stamina.recoveryTime);

				account.stamina.fired = true;
				platform.update(account);

				const description = (stamina.currentStamina === stamina.maxStamina)
					? t("Your stamina is full!")
					: t("Your stamina is within the set threshold!");

				const platforms = app.Platform.getForAccount(account);
				const embed = {
					color: data.assets.color,
					title: t("Stamina Reminder"),
					author: {
						name: data.assets.author,
						icon_url: data.assets.logo
					},
					description,
					fields: [
						{ name: "UID", value: account.uid, inline: true },
						{ name: t("Username"), value: account.nickname, inline: true },
						{ name: t("Region"), value: app.HoyoLab.getRegion(account.region), inline: true },
						{ name: t("Stamina"), value: `${current}/${max}`, inline: true },
						{ name: t("Recovery Time"), value: delta, inline: true }
					],
					timestamp: new Date(),
					footer: {
						text: t("Stamina Reminder"),
						icon_url: data.assets.logo
					}
				};

				for (const destination of app.Platform.getEmbedPlatforms(platforms)) {
					const userId = destination.createUserMention(account.discord);
					await destination.send(embed, {
						content: userId,
						author: data.assets.author,
						icon: data.assets.logo
					});
				}

				const messageText = [
					t `📢 Stamina Reminder, ${description}`,
					t `🎮 **Game**: ${data.assets.game}`,
					t `🆔 **UID**: ${account.uid} ${account.nickname}`,
					t `🌍 **Region**: ${app.HoyoLab.getRegion(account.region)}`,
					t `🔋 **Stamina**: ${current}/${max}`,
					t `🕒 **Recovery Time**: ${delta}`
				].join("\n");

				const escapedMessage = app.Utils.escapeCharacters(messageText);
				for (const telegram of platforms.filter(p => p.name === "telegram")) {
					await telegram.send(escapedMessage);
				}
			}
		}
	})
};
