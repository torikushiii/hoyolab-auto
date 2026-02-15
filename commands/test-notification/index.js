const TestNotification = require("../../singleton/test-notification.js");

module.exports = {
	name: "test-notification",
	description: "Send a test notification to verify platform functionality",
	params: [
		{
			name: "message",
			type: "string",
			description: "Custom message for the test notification",
			required: false
		}
	],

	run: async function (context, message) {
		const { platform } = context;

		if (!platform) {
			return {
				success: false,
				reply: "This command can only be used through Discord or Telegram platforms."
			};
		}

		const customMessage = message || "Manual test notification triggered via command";

		try {
			// For Discord bot commands, the platform object is just metadata
			// We handle the response differently based on the platform
			if (platform.name === "Discord") {
				// For Discord bot, we just return a reply - no need to call external send methods
				const timestamp = new Date().toLocaleString();
				app.Logger.info("TestCommand", `Manual test triggered via Discord bot: ${customMessage}`);

				return {
					success: true,
					reply: `🧪 **Manual Test Notification**\n\n${customMessage}\n\n🔧 **Test Type:** Manual\n🕒 **Triggered At:** ${timestamp}\n🤖 **Platform:** Discord Bot`
				};
			}
			else {
				// For other platforms (webhook, telegram), use the test notification system
				await TestNotification.sendManualTestNotification(platform, {
					message: customMessage
				});

				return {
					success: true,
					reply: "✅ Test notification sent successfully!"
				};
			}
		}
		catch (e) {
			app.Logger.error("TestCommand", `Failed to send test notification: ${e.message}`);

			return {
				success: false,
				reply: `❌ Failed to send test notification: ${e.message}`
			};
		}
	}
};
