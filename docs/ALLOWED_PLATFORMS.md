# allowedPlatforms — Per-Account Platform Routing

The `allowedPlatforms` field lets you control which notification platforms receive messages for each individual account. This makes it possible to have separate Discord channels per game, per account, or any combination you want.

## How It Works

When a cron job fires a notification, it calls `Platform.getForAccount(account)` which returns the filtered list of platforms for that account. The result is then used to send notifications instead of broadcasting to every configured platform.

## Configuration

Add `allowedPlatforms` to any account entry inside a game's `data[]` array:

```json5
{
    id: 3,
    active: true,
    type: 'genshin',
    data: [
        {
            cookie: '...',
            allowedPlatforms: null, // null = all platforms (default)
            // ...
        }
    ]
}
```

### Values

| Value | Behaviour |
|---|---|
| `null` | All configured platforms receive notifications (default — existing behaviour) |
| `[]` | No platforms receive notifications (silences this account) |
| `[3]` | Only the platform with `id: 3` receives notifications |
| `[3, 4]` | Only platforms with `id: 3` and `id: 4` receive notifications |

## Use Case: Multiple Webhooks per Game

Define multiple webhook platforms, each with a unique `id`:

```json5
platforms: [
    {
        id: 2,
        active: true,
        type: 'telegram',
        // ...
    },
    {
        id: 3,
        active: true,
        type: 'webhook',
        url: 'https://discord.com/api/webhooks/.../...', // #genshin channel
    },
    {
        id: 4,
        active: true,
        type: 'webhook',
        url: 'https://discord.com/api/webhooks/.../...', // #starrail channel
    },
]
```

Then point each game account to its own webhook:

```json5
accounts: [
    {
        id: 1,
        active: true,
        type: 'genshin',
        data: [
            {
                cookie: '...',
                allowedPlatforms: [3], // only the #genshin webhook
                // ...
            }
        ]
    },
    {
        id: 2,
        active: true,
        type: 'starrail',
        data: [
            {
                cookie: '...',
                allowedPlatforms: [4], // only the #starrail webhook
                // ...
            }
        ]
    }
]
```

Telegram (`id: 2`) is excluded here — add it to `allowedPlatforms` if you also want Telegram notifications for that account, e.g. `allowedPlatforms: [2, 4]`.

## Use Case: Separate Channels per Account (Multi-Account)

If you have two Star Rail accounts and want them in different Discord channels:

```json5
{
    id: 4,
    active: true,
    type: 'starrail',
    data: [
        {
            cookie: '...account1...',
            allowedPlatforms: [3], // account 1 → #starrail-main
            // ...
        },
        {
            cookie: '...account2...',
            allowedPlatforms: [4], // account 2 → #starrail-alt
            // ...
        }
    ]
}
```

## Use Case: Silence an Account

Set `allowedPlatforms: []` to disable notifications for a specific account without disabling the account itself:

```json5
{
    cookie: '...',
    allowedPlatforms: [], // automation still runs, no notifications sent
    // ...
}
```

## Backwards Compatibility

`allowedPlatforms` is optional. Existing configs that do not include it will behave exactly as before — all configured platforms receive all notifications.
