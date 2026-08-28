# Agent Operations Guide

Operational knowledge for this **fork** of `torikushiii/hoyolab-auto`. Upstream's own docs are in [README.md](README.md) and still describe the app itself accurately.

## What is different about this fork

This fork exists to make failures visible. Upstream cannot report its own failures, and that let code redemption die unnoticed for twelve days in August 2026.

**Upstream is inspiration, not a merge source.** The health module and the notification changes diverge from upstream deliberately, so `git rebase` onto upstream is not the update path. To pick up upstream work, read what actually changed and port it by hand.

Deployment lives in a different repo: `JaneJeon/self-hosted`, under `services/hoyolab-auto/`. A change here reaches production only after its image is published and the `FROM` pin over there is bumped. See that repo's `AGENTS.md`.

## Golden rules

1. **Never log a credential.** Log key *names*, never values. `object/redact.js` strips bot tokens and `cdkey` values out of URLs before they reach a log line. Route new log lines that include a URL through it.
2. **Build and run the Docker image before pushing.** `docker build -t hoyolab-auto-test:local .` then run it against a scratch config. `npm test` alone does not exercise startup, config parsing, or cron registration.
3. **Never use `--no-verify` when committing.**
4. **One logical change per commit.**

## The two credential classes

A HoyoLab cookie holds two independent credentials that expire on different schedules:

- `ltoken_v2` / `ltuid_v2` / `ltmid_v2` drive check-in, Mimo, stamina and reminders.
- `cookie_token_v2` / `account_mid_v2` / `account_id_v2` drive **code redemption only**.

Redemption is the only feature using the second class, so it can be dead while everything else looks healthy. If a cookie arrives without those three fields, `#parseCookie` sets `codeRedeem: false` and redemption **disables itself**, which is why the failure was silent.

Full API reference, including the probe endpoints and their retcodes, is in the shared Craft memory: `Systems/HoYoverse account cookies`.

## The health cron

`crons/health/index.js` runs every 30 minutes and once at startup. It probes each credential class **separately** against HoYoverse's own passport API, then reports to Uptime Kuma:

- All healthy: pushes `status=up`.
- A credential is dead: pushes `status=down` naming the credential and what stops working.
- The probe itself failed (timeout, DNS): pushes **nothing**. A missed heartbeat is the right signal for an undecided check, and Kuma tolerates a couple before paging.

Each probe is sent one class's fields alone. This is load-bearing: `verifyLToken` accepts a `cookie_token` and returns OK, so a probe handed the whole cookie would report health it never tested.

Config lives under `health` in `config.json5`. Leave `kumaPushUrl` empty to log results only, which is the right setting for local runs.

**Set the Kuma monitor's heartbeat interval above the cron's cadence.** Do not copy another monitor's interval, because that decides how hard this hits HoYoverse's API.

## Testing

```bash
npm test     # node:test, no dependencies
npm run lint # needs devDependencies installed
```

Unit tests cover the pure logic: cookie parsing, URL redaction, probe classification, and the health cron's up/down/silent decision. There is no test that talks to HoYoverse. To check the real credential, run a probe inside the deployed container (recipe in `Systems/hoyolab-auto` in Craft), never with the cookie on your own machine.

## Gotchas

- `index.js` shadows the global `Error` with the project's custom class at the top of the file. An `instanceof Error` check therefore excludes native `TypeError` and `SyntaxError`. This is what silently swallowed every crashed cron.
- `crons/index.js` registers jobs as `() => cron.code(cron)` and drops the returned promise, so a rejected cron never fails visibly. The process-level handlers are the only net, and they are registered at the very end of startup, so a failure *during* startup bypasses them and crashes.
- Cookie values are base64-ish and can contain `=`. Split pairs on the **first** `=` only. `object/cookie.js` does this for both callers.
- `hoyolab-modules/template.js` has two cookie parsers: the static `parseCookie` and the private `#parseCookie`. They had drifted apart, which is how a single leading space in a pasted secret disabled redemption.
- The cookie-refresh cron (`crons/update-cookie/`) can never succeed. Its endpoint, `fetch_cookie_accountinfo`, was retired by HoYoverse and now returns `-707` for every input. Its failure path is fixed so it reports rather than throwing, but the cron itself is dead weight pending a decision to remove it.
