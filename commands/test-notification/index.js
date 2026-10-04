const { t, getLocale } = require("../../localization/index.js");

const TestNotification = require("../../singleton/test-notification.js");

module.exports = {
	name: "test-notification",
	description: t("Send a test notification to verify platform functionality"),
	params: [
		{
			name: "message",
			type: "string",
			description: t("Custom message for the test notification"),
			required: false
		}
	],

	run: async function (context, message) {
		const { platform } = context;

		if (!platform) {
			return {
				success: false,
				reply: t("This command can only be used through Discord or Telegram platforms.")
			};
		}

		const customMessage = message || t("Manual test notification triggered via command");

		try {
			// For Discord bot commands, the platform object is just metadata
			// We handle the response differently based on the platform
			if (platform.name === "Discord") {
				// For Discord bot, we just return a reply - no need to call external send methods
				const timestamp = new Date().toLocaleString(getLocale());
				app.Logger.info("TestCommand", t `Manual test triggered via Discord bot: ${customMessage}`);

				return {
					success: true,
					reply: t `🧪 **Manual Test Notification**\n\n${customMessage}\n\n🔧 **Test Type:** Manual\n🕒 **Triggered At:** ${timestamp}\n🤖 **Platform:** Discord Bot`
				};
			}
			else {
				// For other platforms (webhook, telegram), use the test notification system
				await TestNotification.sendManualTestNotification(platform, {
					message: customMessage
				});

				return {
					success: true,
					reply: t("✅ Test notification sent successfully!")
				};
			}
		}
		catch (e) {
			app.Logger.error("TestCommand", t `Failed to send test notification: ${e.message}`);

			return {
				success: false,
				reply: t `❌ Failed to send test notification: ${e.message}`
			};
		}
	}
};
