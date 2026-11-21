# mainRegion & redeemRegions — Redeem Codes on Multiple Servers

One HoYoLAB account can own a character on every server (America, Europe, Asia, TW/HK/MO). By default codes are only redeemed on the character shown on the HoYoLAB game record card.

- `mainRegion` picks your main server. It is redeemed on first and is the only server that receives single-use codes (Mimo, Hilichurl).
- `redeemRegions` adds extra servers that also receive public codes.

Currently supported for **Genshin Impact** only.

## Configuration

```json5
{
    id: 3,
    active: true,
    type: 'genshin',
    data: [
        {
            cookie: '...',
            redeemCode: true,
            mainRegion: 'os_usa',          // 'default' = HoYoLAB card character
            redeemRegions: ['os_asia'],    // [] = main server only
        }
    ]
}
```

| Value | Server |
|-------|--------|
| `os_usa` | America |
| `os_euro` | Europe |
| `os_asia` | Asia |
| `os_cht` | TW, HK, MO |

| `mainRegion` | `redeemRegions` | Codes go to |
|---|---|---|
| `'default'` | `[]` | Card character only (same as before these options existed) |
| `'default'` | `['os_asia']` | Card character first, then Asia |
| `'os_usa'` | `[]` | America only |
| `'os_usa'` | `['os_asia', 'os_euro']` | America first, then Asia, then Europe |

Notes:

- `redeemCode` must be `true`. These options only choose where codes go.
- Listing the main server in `redeemRegions` as well is harmless. It is skipped as a duplicate.
- A `mainRegion` with no character falls back to the card character, with a warning at startup.
- A server in `redeemRegions` with no character is skipped, with a warning at startup.
- To find your card character, open your HoYoLAB profile. The startup log also shows it: `Logged into (<uid>) <name> (<region>)`.
- Daily check-in, stamina, expedition and other features still use the card character.

## Which Codes Go Where

| Code source | Servers |
|---|---|
| Public codes (`code-redeem` job) | Main server first, then each `redeemRegions` server in order |
| Traveling Mimo / Hilichurl Workshop codes | Main server only (single-use codes) |
| Manual Discord/Telegram `redeem` command | Main server first, then each `redeemRegions` server in order |
| Google Apps Script service (`services/google-script`) | Not supported, card character only |

## How It Works

1. **Startup** (`hoyolab-modules/genshin/index.js`, `#getRedeemTargets`): if `mainRegion` is not `'default'` or `redeemRegions` is not empty, login calls

   ```
   GET https://api-account-os.hoyoverse.com/account/binding/api/getUserGameRolesByCookie?game_biz=hk4e_global
   ```

   with the redemption cookies (`cookie_token_v2`, `account_mid_v2`, `account_id_v2`). The response lists every character on the HoYoLAB account with `game_uid`, `region`, `nickname` and `level`.

   The result is stored as `account.redeemTargets`: a list of `{ uid, region, nickname, level }` with the **main server at index 0**, then the `redeemRegions` servers in config order. If the request fails, `redeemTargets` stays `null` and everything falls back to the card character.

2. **Public codes** (`crons/code-redeem/utils.js`, `expandRedeemTargets`): every account with `redeemTargets` is expanded into one copy per target (`{ ...account, ...target }`), in list order, so the main server is redeemed first. Each copy goes through the normal redemption loop, so it gets its own:
   - completed-code cache (`<game>-code:<region>:<uid>`)
   - pending-retry queue and rate limit (`redemption-request.js` keys by `game_biz:region:uid`)
   - success/failure notifications (cookie, `discord` and `allowedPlatforms` are shared)

   Each target also gets a **backfill**: every currently active code that is not in its completed-code cache is tried, not only codes new to the global `<game>-code` list. This lets a newly added or re-added server catch up on codes released before it was listed. If the server already used a backfilled code, the final error (for example "already in use") marks it completed without a failure notification.

   If the card character is not in `redeemTargets`, an extra `pendingOnly` copy is added. It only retries codes already queued for the card character (for example from before `mainRegion` was changed) and never redeems public codes.

3. **Single-use codes** (`hoyolab-modules/genshin/redeem-code.js`): `redeemCode` overrides `uid`/`region` with `redeemTargets[0]`, so Mimo and Hilichurl codes go to the main server.

4. **Manual `redeem` command** (`HoyoLab.redeemCode` in `hoyolab-modules/template.js`, used by Discord `/redeem` and Telegram): loops over `redeemTargets` in order and calls the game's `redeemCode` once per server, with `redeemTargets` cleared so step 3 does not reroute it. The command reports success only if every server succeeded; otherwise the reply lists each server's result. The command has no option to pick servers; it always uses the config.

5. The redemption request itself is unchanged: `webExchangeCdkey` already takes `uid` and `region`.

`redeemTargets` is never pushed into `platform.accounts` as separate accounts. Check-in and reminders iterate that list, so extra entries would cause duplicate check-ins and notifications.

## Adding Another Game

1. In `hoyolab-modules/<game>/index.js`, copy `#getRedeemTargets` and set `redeemTargets` on the pushed account. Change `game_biz`:
   - Honkai: Star Rail: `hkrpg_global` (regions `prod_official_usa`, `prod_official_eur`, `prod_official_asia`, `prod_official_cht`)
   - Zenless Zone Zero: `nap_global` (regions `prod_gf_us`, `prod_gf_eu`, `prod_gf_jp`, `prod_gf_sg`)

   These region IDs come from `HoyoLab.getRegion` in `hoyolab-modules/template.js`. Check them against the API response before shipping.
2. Add the `roles` URL to that game's `DEFAULT_CONSTANTS.url`.
3. Add the `redeemTargets?.[0]` override to `hoyolab-modules/<game>/redeem-code.js`.
4. Add `mainRegion: 'default'` and `redeemRegions: []` to the game's account in `default.config.json5`.
5. Nothing else: `expandRedeemTargets` and the config validation in `hoyolab-modules/template.js` are game-agnostic. Add a test like `redeemRegions redeems public codes once per selected server, main server first` in `tests/redemption-request.test.js`.
