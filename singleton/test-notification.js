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
  for (const platform of platforms.values()) {
    testPromises.push(sendPlatformTestNotification(platform));
  }

  const results = await Promise.allSettled(testPromises);

  let successCount = 0;
  let failureCount = 0;

  for (const [index, result] of results.entries()) {
    const platform = Array.from(platforms.values())[index];
    const platformName = platform.name || 'Unknown Platform';
    const platformId = platform.id || 'Unknown ID';

    if (result.status === "fulfilled") {
      successCount++;
      app.Logger.info("TestNotification", `Successfully sent test notification to ${platformName} (ID: ${platformId})`);
    } else {
      failureCount++;
      app.Logger.error("TestNotification", `Failed to send test notification to ${platformName} (ID: ${platformId}): ${result.reason?.message || 'No error message provided'}`);
    }
  }

  app.Logger.info("TestNotification", `Test notifications completed: ${successCount} successful, ${failureCount} failed`);
}

/**
 * Get the server location and country code using a ipinfo.io API.
 * @returns {object} An object containing the location string and country code.
 */
async function getServerLocation() {
  try {
    const response = await fetch('https://ipinfo.io/json');
    const data = await response.json();
    if (data.city && data.region && data.country) {
      const location = `${data.city}, ${data.region}, ${data.country}`;
      const countryCode = data.country;
      return { location, countryCode };
    }
  } catch (error) {
    app.Logger.error("TestNotification", `Failed to fetch server location: ${error.message}`);
  }
  return { location: "Unknown Location", countryCode: null };
}

/**
 * Converts a two-letter country code to a flag emoji.
 * @param {string} countryCode - The two-letter country code (e.g., "US", "SG").
 * @returns {string} The corresponding flag emoji.
 */
function getCountryFlag(countryCode) {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

/**
 * Send a test notification to a specific platform
 * @param {Platform} platform - Platform instance to send test notification to
 */
async function sendPlatformTestNotification(platform) {
  const { name, id } = platform;
  const platformName = name.toLowerCase();

  try {
    const timestamp = new Date().toISOString();
    const localTime = new Date().toLocaleString();
    const { location, countryCode } = await getServerLocation();
    const flag = getCountryFlag(countryCode);
    const serverLocation = `${flag} ${location}`.trim();

    switch (platformName) {
      case "discord":
        // Send a simple message to Discord bot (if it has access to channels)
        // Note: Discord bots need proper channel access to send messages
        app.Logger.info("TestNotification", `Discord bot (ID: ${id}) is connected and ready`);
        break;

      case "webhook": {
        // Send a test embed to Discord webhook
        const testEmbed = {
          title: "🔥 HoyoLab Auto - Test Notification",
          description: "This is a test notification to confirm that the webhook is working properly.",
          color: 3447003,
          fields: [{
            name: "Status",
            value: "✅ Connected",
            inline: true
          }, {
            name: "Local Time",
            value: localTime,
            inline: true
          }, {
            name: "Server Location",
            value: serverLocation,
            inline: true
          }, {
            name: "Platform",
            value: "Discord Webhook",
            inline: true
          }],
          footer: {
            text: "HoyoLab Auto Test System",
            icon_url: "https://i.ibb.co/nRqTkXv/image.png"
          },
          timestamp
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
          `📍 *Server Location:* ${escapeMarkdown(serverLocation)}\n` +
          `🤖 *Platform:* Telegram Bot\n\n` +
          `🚀 *HoyoLab Auto Started Successfully\\!*`;

        await platform.send(testMessage);
        break;
      }

      default:
        app.Logger.warn("TestNotification", `Unknown platform type: ${name}`);
        break;
    }
  } catch (e) {
    throw new app.Error({
      message: `Failed to send test notification to ${name}`,
      args: {
        error: e.message
      }
    });
  }
}

/**
 * Send a manual test notification (can be used for command testing)
 * @param {Platform} platform - Platform instance to send test notification to
 * @param {Object} options - Additional options for the test message
 */
async function sendManualTestNotification(platform, options = {}) {
  const { name, id } = platform;
  const customMessage = options.message || "Manual test notification triggered";

  try {
    const timestamp = new Date().toISOString();
    const localTime = new Date().toLocaleString();
    const { location, countryCode } = await getServerLocation();
    const flag = getCountryFlag(countryCode);
    const serverLocation = `${flag} ${location}`.trim();
    const platformName = name.toLowerCase();

    switch (platformName) {
      case "webhook": {
        const testEmbed = {
          title: "🧪 HoyoLab Auto - Manual Test",
          description: customMessage,
          color: 16776960,
          fields: [{
            name: "Test Type",
            value: "Manual",
            inline: true
          }, {
            name: "Triggered At",
            value: localTime,
            inline: true
          }, {
            name: "Server Location",
            value: serverLocation,
            inline: true
          }, {
            name: "Platform",
            value: "Discord Webhook",
            inline: true
          }],
          footer: {
            text: "HoyoLab Auto Manual Test",
            icon_url: "https://i.ibb.co/nRqTkXv/image.png"
          },
          timestamp
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
          `📍 *Server Location:* ${escapeMarkdown(serverLocation)}\n` +
          `🤖 *Platform:* Telegram Bot`;

        await platform.send(testMessage);
        break;
      }

      case "discord":
        app.Logger.info("TestNotification", `Manual test triggered for Discord bot (ID: ${id}): ${customMessage}`);
        return true;

      default:
        app.Logger.warn("TestNotification", `Manual test not supported for platform type: ${name}`);
        break;
    }

    return true;
  } catch (e) {
    throw new app.Error({
      message: `Failed to send manual test notification to ${name}`,
      args: {
        error: e.message
      }
    });
  }
}

module.exports = {
  sendTestNotifications,
  sendPlatformTestNotification,
  sendManualTestNotification
};
