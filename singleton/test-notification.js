const { t, getLocale } = require("../localization/index.js");

/**
 * Test Notification Utility
 * Handles sending test notifications to confirm platform functionality
 */

/**
 * Send test notifications to all configured platforms to confirm functionality
 * @param {Set} platforms - Set of configured platform instances
 */
async function sendTestNotifications (platforms) {
	if (platforms.size === 0) {
		app.Logger.warn("TestNotification", t("No platforms configured for test notifications"));
		return;
	}

	app.Logger.info("TestNotification", t("Sending test notifications to all configured platforms"));

	const testPromises = [];
	for (const platform of platforms) {
		testPromises.push(sendPlatformTestNotification(platform));
	}

	const results = await Promise.allSettled(testPromises);

	let successCount = 0;
	let failureCount = 0;

	const platformArray = Array.from(platforms);
	for (const [index, result] of results.entries()) {
		const platform = platformArray[index];

		if (result.status === "fulfilled") {
			successCount++;
			app.Logger.info("TestNotification", t `Successfully sent test notification to ${platform.name} (ID: ${platform.id})`);
		}
		else {
			failureCount++;
			app.Logger.error("TestNotification", t `Failed to send test notification to ${platform.name} (ID: ${platform.id}): ${result.reason.message}`);
		}
	}

	app.Logger.info("TestNotification", t `Test notifications completed: ${successCount} successful, ${failureCount} failed`);
}

/**
 * Send a test notification to a specific platform
 * @param {Platform} platform - Platform instance to send test notification to
 */
async function sendPlatformTestNotification (platform) {
	try {
		const timestamp = new Date().toISOString();
		const localTime = new Date().toLocaleString(getLocale());

		const platformName = platform.name?.toLowerCase() || "unknown";
		switch (platformName) {
			case "discord":
				// Send a simple message to Discord bot (if it has access to channels)
				// Note: Discord bots need proper channel access to send messages
				app.Logger.info("TestNotification", t `Discord bot (ID: ${platform.id}) is connected and ready`);
				break;

			case "gotify":
			case "webhook": {
				const platformLabel = platformName === "gotify" ? "Gotify" : t("Discord Webhook");
				const testEmbed = {
					title: t("🔥 HoyoLab Auto - Test Notification"),
					description: t `This is a test notification to confirm that ${platformLabel} is working properly.`,
					color: 3447003,
					fields: [
						{
							name: t("Status"),
							value: t("✅ Connected"),
							inline: true
						},
						{
							name: t("Local Time"),
							value: localTime,
							inline: true
						},
						{
							name: t("Platform"),
							value: platformLabel,
							inline: true
						}
					],
					footer: {
						text: t("HoyoLab Auto Test System"),
						icon_url: "https://i.ibb.co/nRqTkXv/image.png"
					},
					timestamp
				};

				await platform.send(testEmbed, {
					content: t("🚀 **HoyoLab Auto Started Successfully!**"),
					author: "HoyoLab Auto",
					icon: "https://i.ibb.co/nRqTkXv/image.png"
				});
				break;
			}

			case "telegram": {
				// Send a test message to Telegram
				const escapeMarkdown = (text) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
				const testMessage = t `🔥 *HoyoLab Auto \\- Test Notification*\n\n`
					+ t `This is a test notification to confirm that the Telegram bot is working properly\\.\n\n`
					+ t `✅ *Status:* Connected\n`
					+ t `🕒 *Local Time:* ${escapeMarkdown(localTime)}\n`
					+ t `🤖 *Platform:* Telegram Bot\n\n`
					+ t `🚀 *HoyoLab Auto Started Successfully\\!*`;

				await platform.send(testMessage);
				break;
			}

			default:
				app.Logger.warn("TestNotification", t `Unknown platform type: ${platform.name || "undefined"}`);
				break;
		}
	}
	catch (e) {
		throw new app.Error({
			message: t `Failed to send test notification to ${platform.name || t("undefined platform")}`,
			args: { error: e.message }
		});
	}
}

/**
 * Send a manual test notification (can be used for command testing)
 * @param {Platform} platform - Platform instance to send test notification to
 * @param {Object} options - Additional options for the test message
 */
async function sendManualTestNotification (platform, options = {}) {
	const customMessage = options.message || t("Manual test notification triggered");

	try {
		const timestamp = new Date().toISOString();
		const localTime = new Date().toLocaleString(getLocale());

		const platformName = platform.name?.toLowerCase() || "unknown";
		switch (platformName) {
			case "gotify":
			case "webhook": {
				const platformLabel = platformName === "gotify" ? "Gotify" : t("Discord Webhook");
				const testEmbed = {
					title: t("🧪 HoyoLab Auto - Manual Test"),
					description: customMessage,
					color: 16776960, // Yellow color for manual tests
					fields: [
						{
							name: t("Test Type"),
							value: t("Manual"),
							inline: true
						},
						{
							name: t("Triggered At"),
							value: localTime,
							inline: true
						},
						{
							name: t("Platform"),
							value: platformLabel,
							inline: true
						}
					],
					footer: {
						text: t("HoyoLab Auto Manual Test"),
						icon_url: "https://i.ibb.co/nRqTkXv/image.png"
					},
					timestamp
				};

				await platform.send(testEmbed, {
					content: t("🧪 **Manual Test Notification**"),
					author: "HoyoLab Auto",
					icon: "https://i.ibb.co/nRqTkXv/image.png"
				});
				break;
			}

			case "telegram": {
				const escapeMarkdown = (text) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
				const testMessage = t `🧪 *HoyoLab Auto \\- Manual Test*\n\n`
					+ `${escapeMarkdown(customMessage)}\n\n`
					+ t `🔧 *Test Type:* Manual\n`
					+ t `🕒 *Triggered At:* ${escapeMarkdown(localTime)}\n`
					+ t `🤖 *Platform:* Telegram Bot`;

				await platform.send(testMessage);
				break;
			}

			case "discord":
				// For Discord bots, we can't use the simple send method directly from the command
				// The Discord platform context doesn't have the same send method as webhooks
				// Instead, we'll return a reply that will be handled by the Discord platform
				app.Logger.info("TestNotification", t `Manual test triggered for Discord bot (ID: ${platform.id}): ${customMessage}`);
				return true;

			default:
				app.Logger.warn("TestNotification", t `Manual test not supported for platform type: ${platform.name || "undefined"}`);
				break;
		}

		return true;
	}
	catch (e) {
		throw new app.Error({
			message: t `Failed to send manual test notification to ${platform.name || t("undefined platform")}`,
			args: { error: e.message }
		});
	}
}

module.exports = {
	sendTestNotifications,
	sendPlatformTestNotification,
	sendManualTestNotification
};
