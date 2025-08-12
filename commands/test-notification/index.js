const { SlashCommandBuilder } = require("discord.js");
const TestNotification = require("../../singleton/test-notification.js");

module.exports = {
	definition: {
		name: "test-notification",
		description: "Send a test notification to verify platform functionality",
		aliases: ["test", "ping"],
		params: [
			{
				name: "message",
				type: "string",
				description: "Custom message for the test notification",
				required: false
			}
		],
		examples: [
			{
				usage: "$test-notification",
				description: "Send a default test notification"
			},
			{
				usage: "$test-notification Testing webhook functionality",
				description: "Send a test notification with a custom message"
			}
		],
		whitelist: {
			response: "You do not have permission to use this command."
		}
	},
	
	getSlashCommandData () {
		return new SlashCommandBuilder()
			.setName("test-notification")
			.setDescription("Send a test notification to verify platform functionality")
			.addStringOption(option => 
				option
					.setName("message")
					.setDescription("Custom message for the test notification")
					.setRequired(false)
			);
	},

	async execute (context, ...args) {
		const { platform } = context;
		
		if (!platform) {
			return {
				success: false,
				reply: "This command can only be used through Discord or Telegram platforms."
			};
		}

		const customMessage = args.join(" ") || "Manual test notification triggered via command";
		
		try {
			await TestNotification.sendManualTestNotification(platform, { 
				message: customMessage 
			});
			
			return {
				success: true,
				reply: "✅ Test notification sent successfully!"
			};
		} catch (error) {
			app.Logger.error("TestCommand", `Failed to send test notification: ${error.message}`);
			
			return {
				success: false,
				reply: `❌ Failed to send test notification: ${error.message}`
			};
		}
	}
};
