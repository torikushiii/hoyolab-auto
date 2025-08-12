/**
 * Test Notification Utility
 * Handles sending test notifications to confirm platform functionality
 */

/**
 * Send test notifications to all configured platforms to confirm functionality
 * @param {Set} platforms - Set of configured platform instances
 */
async function sendTestNotifications(platforms) {
	if (platforms.size === 0) {
		app.Logger.warn("TestNotification", "No platforms configured for test notifications");
		return;
	}

	app.Logger.info("TestNotification", "Sending test notifications to all configured platforms");

	const testPromises = [];
	for (const platform of platforms) {
		testPromises.push(sendPlatformTestNotification(platform));
	}

	const results = await Promise.allSettled(testPromises);
	
	let successCount = 0;
	let failureCount = 0;

	results.forEach((result, index) => {
		const platformArray = Array.from(platforms);
		const platform = platformArray[index];
		
		if (result.status === "fulfilled") {
			successCount++;
			app.Logger.info("TestNotification", `Successfully sent test notification to ${platform.name} (ID: ${platform.id})`);
		} else {
			failureCount++;
			app.Logger.error("TestNotification", `Failed to send test notification to ${platform.name} (ID: ${platform.id}): ${result.reason.message}`);
		}
	});

	app.Logger.info("TestNotification", `Test notifications completed: ${successCount} successful, ${failureCount} failed`);
}

/**
 * Send a test notification to a specific platform
 * @param {Platform} platform - Platform instance to send test notification to
 */
async function sendPlatformTestNotification(platform) {
	try {
		const timestamp = new Date().toISOString();
		const localTime = new Date().toLocaleString();
		
		switch (platform.name) {
			case "discord":
				// Send a simple message to Discord bot (if it has access to channels)
				// Note: Discord bots need proper channel access to send messages
				app.Logger.info("TestNotification", `Discord bot (ID: ${platform.id}) is connected and ready`);
				break;
				
			case "webhook": {
				// Send a test embed to Discord webhook
				const testEmbed = {
					title: "🔥 HoyoLab Auto - Test Notification",
					description: "This is a test notification to confirm that the webhook is working properly.",
					color: 3447003, // Blue color
					fields: [
						{
							name: "Status",
							value: "✅ Connected",
							inline: true
						},
						{
							name: "Local Time",
							value: localTime,
							inline: true
						},
						{
							name: "Platform",
							value: "Discord Webhook",
							inline: true
						}
					],
					footer: {
						text: "HoyoLab Auto Test System",
						icon_url: "https://i.ibb.co/nRqTkXv/image.png"
					},
					timestamp: timestamp
				};

				await platform.send(testEmbed, {
					content: "🚀 **HoyoLab Auto Started Successfully!**",
					author: "HoyoLab Auto",
					icon: "https://i.ibb.co/nRqTkXv/image.png"
				});
				break;
			}
				
			case "telegram": {
				// Send a test message to Telegram
				const escapeMarkdown = (text) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
				const testMessage = `🔥 *HoyoLab Auto \\- Test Notification*\n\n` +
					`This is a test notification to confirm that the Telegram bot is working properly\\.\n\n` +
					`✅ *Status:* Connected\n` +
					`🕒 *Local Time:* ${escapeMarkdown(localTime)}\n` +
					`🤖 *Platform:* Telegram Bot\n\n` +
					`🚀 *HoyoLab Auto Started Successfully\\!*`;

				await platform.send(testMessage);
				break;
			}
				
			default:
				app.Logger.warn("TestNotification", `Unknown platform type: ${platform.name}`);
				break;
		}
	} catch (error) {
		throw new app.Error({
			message: `Failed to send test notification to ${platform.name}`,
			args: { error: error.message }
		});
	}
}

/**
 * Send a manual test notification (can be used for command testing)
 * @param {Platform} platform - Platform instance to send test notification to
 * @param {Object} options - Additional options for the test message
 */
async function sendManualTestNotification(platform, options = {}) {
	const customMessage = options.message || "Manual test notification triggered";
	
	try {
		const timestamp = new Date().toISOString();
		const localTime = new Date().toLocaleString();
		
		switch (platform.name) {
			case "webhook": {
				const testEmbed = {
					title: "🧪 HoyoLab Auto - Manual Test",
					description: customMessage,
					color: 16776960, // Yellow color for manual tests
					fields: [
						{
							name: "Test Type",
							value: "Manual",
							inline: true
						},
						{
							name: "Triggered At",
							value: localTime,
							inline: true
						},
						{
							name: "Platform",
							value: "Discord Webhook",
							inline: true
						}
					],
					footer: {
						text: "HoyoLab Auto Manual Test",
						icon_url: "https://i.ibb.co/nRqTkXv/image.png"
					},
					timestamp: timestamp
				};

				await platform.send(testEmbed, {
					content: "🧪 **Manual Test Notification**",
					author: "HoyoLab Auto",
					icon: "https://i.ibb.co/nRqTkXv/image.png"
				});
				break;
			}
				
			case "telegram": {
				const escapeMarkdown = (text) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
				const testMessage = `🧪 *HoyoLab Auto \\- Manual Test*\n\n` +
					`${escapeMarkdown(customMessage)}\n\n` +
					`🔧 *Test Type:* Manual\n` +
					`🕒 *Triggered At:* ${escapeMarkdown(localTime)}\n` +
					`🤖 *Platform:* Telegram Bot`;

				await platform.send(testMessage);
				break;
			}
				
			default:
				app.Logger.warn("TestNotification", `Manual test not supported for platform type: ${platform.name}`);
				break;
		}
		
		return true;
	} catch (error) {
		throw new app.Error({
			message: `Failed to send manual test notification to ${platform.name}`,
			args: { error: error.message }
		});
	}
}

module.exports = {
	sendTestNotifications,
	sendPlatformTestNotification,
	sendManualTestNotification
};
