# Gotify notifications

[Gotify](https://gotify.net/) is a self-hosted notification server. HoyoLab Auto
can send check-in results, reminders, code redemption results, Mimo and Hilichurl
updates, and cookie refresh alerts to it.

## Setup

1. Run a Gotify server and open its web UI.
2. Create an application, such as **HoyoLab Auto**, and copy the application token.
3. Connect your Gotify client to that server to receive notifications on your phone.
4. Add a platform entry to `config.json5`, or fill in the Gotify section in the
   [configuration generator](./config/index.html):

```json5
platforms: [
    // Other platforms can stay here.
    {
        id: 4, // Choose an ID that is unique among your platforms.
        active: true,
        type: 'gotify',
        url: 'https://gotify.example.com',
        token: 'YOUR_GOTIFY_APP_TOKEN',
        priority: 5, // Optional integer; defaults to 5.
    },
],
```

Use the server's base URL, including any reverse proxy path, such as
`https://example.com/gotify`. HoyoLab Auto appends `/message` automatically.
Both HTTP and HTTPS are supported. The application token is sent in the
`X-Gotify-Key` header.

The token must belong to a Gotify **application**. A client token is used to read
notifications and cannot be used to send them. Your Gotify client determines how
the configured [priority](https://gotify.net/docs/priority) affects sounds and
notification visibility. Messages use Markdown to preserve notification formatting.

Gotify receives outbound notifications; commands remain available through the
existing Discord and Telegram bots.

## Account routing

Gotify follows the same `allowedPlatforms` setting as the other platforms. For
example, set `allowedPlatforms: [4]` on an account to send its notifications only
to the Gotify platform above. `null` sends to all platforms, and `[]` silences the
account. See [per-account routing](../docs/ALLOWED_PLATFORMS.md).

## Verify delivery

Set `testNotification.enabled` to `true` in `config.json5`. When the application
starts, it sends a Gotify test message with its status and local time. Delivery
failures are reported in the application logs.

The server must be reachable from the process running HoyoLab Auto. When running
in Docker, `localhost` refers to the HoyoLab Auto container; use a reachable
hostname or the Gotify service name on a shared Docker network instead.
