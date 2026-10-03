const { t } = require("../../localization/index.js");

const RegionalTaskManager = new app.RegionalTaskManager();
const config = require("../../config.js");

const reminderHour = config.crons?.dailiesReminderHour ?? 21;
const reminderMinute = config.crons?.dailiesReminderMinute ?? 0;
const reminderTimeZone = config.crons?.dailiesReminderTimeZone || null;

RegionalTaskManager.registerTask("DailiesReminder", reminderHour, reminderMinute, async (account) => {
	if (account.dailiesCheck === false) {
		return;
	}

	const platform = app.HoyoLab.get(account.platform);
	const notes = await platform.notes(account);
	if (notes.success === false) {
		return false;
	}

	const { data } = notes;
	const current = Math.floor(data.stamina.currentStamina);
	const max = data.stamina.maxStamina;
	const delta = app.Utils.formatTime(data.stamina.recoveryTime);

	if (data.dailies.task === data.dailies.maxTask) {
		return;
	}

	const platforms = app.Platform.getForAccount(account);
	const embed = {
		color: data.assets.color,
		title: t("Dailies Reminder"),
		author: {
			name: data.assets.author,
			icon_url: data.assets.logo
		},
		description: t("Don't forget to complete your dailies!"),
		fields: [
			{ name: "UID", value: account.uid, inline: true },
			{ name: t("Username"), value: account.nickname, inline: true },
			{ name: t("Region"), value: app.HoyoLab.getRegion(account.region), inline: true },
			{ name: t("Completed Dailies"), value: `${data.dailies.task}/${data.dailies.maxTask}`, inline: true },
			{ name: t("Current Stamina"), value: `${current}/${max} (${delta})`, inline: true }
		],
		timestamp: new Date(),
		footer: {
			text: t("Dailies Reminder"),
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
		t `📢 Dailies Reminder, Don't Forget to Do Your Dailies!`,
		t `🎮 **Game**: ${data.assets.game}`,
		t `🆔 **UID**: ${account.uid} ${account.nickname}`,
		t `🌍 **Region**: ${app.HoyoLab.getRegion(account.region)}`,
		t `📅 **Completed Dailies**: ${data.dailies.task}/${data.dailies.maxTask}`,
		t `🔋 **Current Stamina**: ${current}/${max} (${delta})`
	].join("\n");

	const escapedMessage = app.Utils.escapeCharacters(messageText);
	for (const telegram of platforms.filter(p => p.name === "telegram")) {
		await telegram.send(escapedMessage);
	}
}, { timeZone: reminderTimeZone });

module.exports = {
	name: "dailies-reminder",
	expression: "* * * * *",
	description: t("Reminds you to complete your dailies."),
	code: (async function dailiesReminder () {
		// eslint-disable-next-line object-curly-spacing
		await RegionalTaskManager.executeTasks({ blacklist: ["honkai", "tot"] });
	})
};
