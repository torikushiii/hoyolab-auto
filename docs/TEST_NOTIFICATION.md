# Test Notification Feature

The HoyoLab Auto application now includes a **Test Notification** feature that helps verify platform functionality when the application starts.

## Overview

When the application initializes, it will automatically send test notifications to all configured platforms (Discord webhooks, Telegram bots, etc.) to confirm they are working properly. This helps you quickly identify any configuration issues with your notification platforms.

## Configuration

The test notification feature can be controlled through the `config.json5` file:

```json5
{
    // Test notification settings
    testNotification: {
        enabled: true, // Set to false if you don't want to receive test notifications on startup
    },
    // ... rest of your configuration
}
```

### Options

- `enabled` (boolean): Controls whether test notifications are sent on application startup
  - `true` (default): Send test notifications on startup
  - `false`: Skip test notifications

## What Gets Sent

### Discord Webhooks

- Rich embed with application status
- Timestamp and platform information
- Visual confirmation that webhook integration is working

### Telegram Bots

- Formatted message with markdown
- Status confirmation and timestamp
- Verification that bot can send messages to the configured chat

### Discord Bots

- Connection status logged (Discord bots require channel access to send messages)

## Manual Testing

You can also manually test notifications using the `test-notification` command:

### Discord (Bot)

```text
$test-notification
$test-notification Custom message here
```

### Telegram

```text
/test-notification
/test-notification Custom message here
```

## Troubleshooting

### Common Issues

1. **Webhook URL Invalid**
   - Ensure your Discord webhook URL is correct and active
   - Check that the webhook hasn't been deleted from Discord

2. **Telegram Bot Issues**
   - Verify your bot token is correct
   - Ensure the bot has been started by sending `/start` in the chat
   - Check that the chat ID is correct

3. **Discord Bot Issues**
   - Ensure the bot has proper permissions in your server
   - Bot needs `Send Messages` permission in channels where it will post

### Logs

Test notification activities are logged with the `TestNotification` category. Check your logs for:

- Success messages when notifications are sent
- Error messages if notifications fail
- Platform-specific connection status

### Example Log Output

```text
[INFO] TestNotification: Sending test notifications to all configured platforms
[INFO] TestNotification: Successfully sent test notification to webhook (ID: 3)
[INFO] TestNotification: Successfully sent test notification to telegram (ID: 2)
[INFO] TestNotification: Test notifications completed: 2 successful, 0 failed
```

## Benefits

1. **Immediate Feedback**: Know right away if your notification platforms are working
2. **Configuration Validation**: Catch configuration errors early
3. **Peace of Mind**: Confirmation that you'll receive important game notifications
4. **Quick Testing**: Manual command for testing changes or troubleshooting

The test notification feature ensures that your HoyoLab Auto setup is fully functional and ready to keep you informed about your HoYoverse games!
