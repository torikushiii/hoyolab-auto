<h1 align="center">
    <img width="120" height="120" src="https://i.ibb.co/nRqTkXv/image.png" alt="HoyoLab Auto Logo"><br>
    HoyoLab Auto
</h1>

<p align="center">
   <img src="https://img.shields.io/badge/NodeJS-20.2.0-green" alt="NodeJS version badge">
   <img src="https://img.shields.io/github/license/torikushiii/hoyolab-auto" alt="License badge">
   <img src="https://img.shields.io/github/stars/torikushiii/hoyolab-auto" alt="GitHub stars badge">
</p>

# HoyoLab Auto

A multi-purpose tool for any supported Hoyoverse games. This tool is designed to assist with daily check-ins, stamina checks, expedition checks, automatic code-redemption, and more.

## Table of Contents
- [HoyoLab Auto](#hoyolab-auto)
  - [Table of Contents](#table-of-contents)
  - [Google App Script](#google-app-script)
  - [Supported Games](#supported-games)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
    - [Language](#language)
    - [Cache File Location](#cache-file-location)
  - [Migration](#migration)
  - [Usage](#usage)
  - [Notifications Setup](#notifications-setup)
  - [Running with Docker](#running-with-docker)
  - [Contributing](#contributing)
  - [Buy Me a Coffee](#buy-me-a-coffee)

## Google App Script
If you don't have a server to run this script and simply just want to use it for checking in, you can use Google App Script.
  - [Google App Script](./services/google-script/README.md)

## Supported Games
- [x] Honkai Impact 3rd (Daily Check-In only)
- [x] Tears of Themis (Daily Check-In only)
- [x] Genshin Impact
- [x] Honkai: Star Rail
- [x] Zenless Zone Zero

## Features
Daily reminders use game server time by default. Set `crons.dailiesReminderTimeZone`
to an IANA timezone such as `America/New_York` to use local time with daylight-saving changes.

- **Honkai Impact 3rd**:
  - **Daily check-in**: Runs every midnight local time.

- **Tears of Themis**:
  - **Daily check-in**: Runs every midnight local time.

- **Genshin Impact**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies at the configured time (21:00 game server time by default).
  - **Weeklies**: Reminds you to do your weekly bosses/discounted resin if you haven't done them at 09:00 (local time).
  - **Stamina check**: Reminds you to spend your resin if you're at your set threshold or capped.
  - **Expedition check**: Check your expeditions and sends a notification if they're done.
  - **Realm currency**: Sends a notification if your realm currency is capped.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Traveler's Diary**: Check your monthly currency income.
- **Honkai: Star Rail**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies at the configured time (21:00 game server time by default).
  - **Stamina check**: Reminds you to spend your stamina if you're at your set threshold or capped.
  - **Expedition check**: Check your expeditions and sends a notification if they're done.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Trailblazer Monthly Calendar**: Check your monthly currency income.
  - **Traveling Mimo**: Automatically complete Mimo tasks, claim points, and exchange for Stellar Jade.
- **Zenless Zone Zero**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies at the configured time (21:00 game server time by default).
  - **Stamina check**: Reminds you to spend your stamina if you're at your set threshold or capped.
  - **Daily Lottery**: Notifies you at 21:00 game server time if you haven't claimed the daily lottery reward. Set `dailyLotteryCheck` to `false` on a ZZZ account to disable it.
  - **Shop Status**: Notifies you if the shop has finished selling videos.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Traveling Mimo**: Automatically complete Mimo tasks, claim points, and exchange for Polychrome.

## Prerequisites
- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/)

## Installation
1. Clone the repository.
2. Run `npm install` to install the dependencies.
3. You can configure your config using one of the following methods:

    1. **Using the Setup Script:**
      - For Windows, run the following npm script from the project root:
        ```bash
        npm run setup:windows
        ```
      - For Linux, use this command:
        ```bash
        npm run setup:linux
        ```
      - These commands will automatically open your default web browser to help you configure your settings through a web-based interface.

    2. **Manual Configuration:**
      - Copy the `default.config.json5` file to create a `config.json5` file:
        ```bash
        cp default.config.json5 config.json5
        ```
      - Open `config.json5` and update it with your application's configuration settings.

4. Follow the instructions in the `default.config.json5` or `config.json5` file.
5. Run the application:
   ```bash
   npm start
   ```

### Language

The Node.js application defaults to `en-us`. Set the top-level `language` option in
`config.json5` to another lowercase HoYoLAB locale, for example:

```json5
language: 'it-it',
```

This sets the existing HoYoLAB language headers and locale fields used by diaries,
Genshin code redemption, Mimo, and Hilichurl. Genshin daily check-in requests
(`info`, `home`, and `sign`) also use this locale in their `lang` query parameter.
The same option selects the software language for commands, notifications, logs,
errors, and the setup generator. An exact regional catalog (such as `it-ch.js`)
takes precedence over the generic language catalog (`it.js`). English and Italian
are included; unsupported software locales and missing translations fall back to English without changing
the configured API locale. For example, `language: 'ja-jp'` still requests Japanese
from HoYoLAB while the software uses English. Restart the application after changing
its language. Game names, command names, configuration keys, and API-provided text
are not translated by the software.

The setup generator switches language when this field changes or a configuration
is imported, and preserves the locale when exporting. Startup errors before a
configuration can be read remain in English. See [translation maintenance](localization/README.md)
for adding or updating a language through one catalog file.

### Randomized scheduling

Each job has one schedule under `crons`: choose `cron`, `interval`, or `daily-window`. Fixed cron schedules remain the default; existing string values such as `checkIn: '0 0 0 * * *'` are still supported. Omitted jobs keep their built-in schedules.

The internal polling jobs `dailiesReminder`, `howlScratchCard`, and `weekliesReminder` retain their built-in fixed schedules. Schedule objects for these jobs are rejected; legacy string overrides remain ignored. Whitelist/blacklist filters apply before schedule validation.

These three reminder jobs automatically select a random time per account within the remaining part of their existing five-minute window, using the account's server time or the configured dailies timezone. Choices and attempt markers persist in the cache; each account receives at most one attempt per reminder and local date, including failed requests. Polling schedules stay fixed, but one-shot timers invoke the API at the selected time. A restart reuses the choice while the window is open; expired windows are skipped.

Mimo/Hilichurl operation pauses and code redemption pauses automatically add a fresh random delay of 0–2 seconds to their existing minimum cooldowns. This also applies when these operations are invoked manually. Rate-limit retry delays, Telegram polling, Diary, and the separate Google Apps Script implementation are unchanged.

```json5
crons: {
    stamina: { mode: 'cron', expression: '0 */30 * * * *' },
    expedition: { mode: 'interval', min: '30m', max: '1h' },
    checkIn: { mode: 'daily-window', start: '00:30', end: '02:00' },
},
```

Interval bounds accept one or more number/unit pairs: `ms`, `s`, `m`, `h`, `d`, or `w` (for example `30m`, `1.5h`, `1h30m`, or `1d 2h`). Components are added together. Days and weeks mean fixed durations of 24 hours and 7 days. Interval mode enforces a minimum delay of **5 minutes** after completion: both bounds must be at least `5m`, with `max >= min`. Shorter durations are rejected at startup, including equivalent values in seconds or milliseconds.

The example selects a new 30–60 minute delay after each execution **completes**, preventing overlap; an expired interval at startup gets a fresh delay. Daily windows use local process time (`HH:mm`; equal start/end is rejected) and invoke a job at most once per local date. A saved choice due earlier today runs once on restart; starting after the window without a saved choice waits until tomorrow. Timers may run late if the process is busy or suspended.

An end earlier than the start crosses midnight: `checkIn: { mode: 'daily-window', start: '23:00', end: '01:00' }`. Each window permits one attempt and retains its identity across midnight and restarts. Startup after midnight uses the remaining part of the active window. A choice due before midnight can still run until that window ends. To preserve the one-attempt-per-local-date limit, an attempt after midnight restricts the following window to its next-day portion.

Schedules and daily attempt markers persist in `data/cache.json`. Keep this file across restarts and run only one application process per cache; deleting it resets these protections. Failed daily attempts wait for the next day. Disable `mimoJitter`/`hilichurlJitter` (set to `0`) before randomizing that job; combining them is rejected. Whitelist/blacklist rules still apply.

The setup generator offers all three modes and exports the unified object format, while preserving imported cron options it does not expose. This feature provides scheduling variability, not account-safety guarantees.

### Cache File Location

After running the application for the first time, a cache file will be automatically created at:
```
./data/cache.json
```

This file stores temporary data to improve performance and reduce API calls. The `data/` directory structure will look like this:
```
project-root/
├── data/
│   ├── cache.json    # Auto-generated cache file
│   └── README.md     # Cache documentation
├── logs/             # Application logs (if logging is enabled)
├── config.json5      # Your configuration file
└── ...
```

**Important Notes:**
- The cache file is automatically managed by the application
- Do not manually edit the cache file
- The cache file will be recreated if deleted
- You can safely delete the cache file to reset cached data
- The `data/` directory must be writable by the application

## Migration

> [!NOTE]
> If you're using this project since the `config.js` file or `config.jsonc` and you're updating to the latest version, please run the following command to migrate your configuration to the new format.

```bash
npm run migrate
```

or

```bash
node convert.js
```

## Usage
For a detailed usage guide, refer to this gist: [Cookie Guide](https://gist.github.com/torikushiii/59eff33fc8ea89dbc0b2e7652db9d3fd).

If your cookie also contains `stoken`, HoyoLab Auto uses it to refresh
`ltoken_v2` and `cookie_token_v2` on startup and every two hours. Keep the
configured cookie private; `stoken` is not sent with regular HoYoLAB requests.
Only one game entry needs it when several games use the same HoYoLAB account.
Browser sessions do not normally expose `stoken`; it must come from an app login.
The optional [HoYoLAB cookie helper](https://github.com/Smexhy/hoyolab-cookie-helper)
can obtain it locally on Windows, macOS, or Linux. It is a third-party helper
and is only needed for automatic cookie refresh.

## Notifications Setup
For setting up Discord or Telegram notifications, refer to the [setup folder](https://github.com/torikushiii/hoyolab-auto/tree/main/setup).

[Gotify notifications](./setup/GOTIFY.md) are also supported. Configure a `gotify`
platform with your server URL and application token to receive check-in results,
reminders, redemption results, and cookie alerts. The setup generator can import
and export these settings. Per-account `allowedPlatforms` routing applies to Gotify.

## Running with Docker

This application can be easily managed and run using Docker. We provide a Makefile
for convenience, but you can also use Docker commands directly.

**1. Prerequisites**

- **Docker:**  Ensure Docker is installed and running. Download it from [https://www.docker.com/](https://www.docker.com/).
- **Docker Compose:** Most Docker installations include Docker Compose. If not, install it from [https://docs.docker.com/compose/install/](https://docs.docker.com/compose/install/).

**2. Configuration**

You can configure your config using one of the following methods:

1. **Using the Setup Script:**
   - For Windows, run the following npm script from the project root:
     ```bash
     npm run setup:windows
     ```
   - For Linux, use this command:
     ```bash
     npm run setup:linux
     ```
   - These commands will automatically open your default web browser to help you configure your settings through a web-based interface.

2. **Manual Configuration:**
   - Copy the `default.config.json5` file to create a `config.json5` file:
     ```bash
     cp default.config.json5 config.json5
     ```
   - Open `config.json5` and update it with your application's configuration settings.
   - Set environment variable `CONFIG_PATH` to alter the configuration file path (default to `./config.json5`).

**Important for Docker Users:**
> [!NOTE]
> When running with Docker, the cache file will be created inside the container at `/app/data/cache.json`. To persist cache data between container restarts, ensure the `data` directory is properly mounted as a volume (this is already configured in the provided `docker-compose.yml`).
> If this is your first time running docker:
> - Make sure your user is listed in the docker group, you can do so by running `sudo usermod -aG docker $USER`, logging out and back in
> - From the project root, grant yourself perms to not have errors while accessing certain folders such as `data`. We can fix this by running `sudo chown -R $USER:$USER data logs && chmod -R 777 data logs`

**3. Building and Running with Docker Compose**

**Using the Makefile (Recommended):**

The provided Makefile simplifies common Docker tasks.

- **Build the image:**
  ```bash
  make build
  ```
- **Start the application:**
  ```bash
  make up
  ```
- **Stop the application:**
  ```bash
  make down
  ```
- **View logs:**
  ```bash
  make logs
  ```
- **Rebuild and restart:**
  ```bash
  make update
  ```

  For a complete list of available Makefile targets, run:

  ```bash
  make help
  ```

**Using Docker Compose Directly:**

If you prefer not to use the Makefile, you can use the following Docker Compose commands:

- **Build the image:**
  ```bash
  docker-compose build
  ```
- **Start the application:**
  ```bash
  docker-compose up -d
  ```
- **Stop the application:**
  ```bash
  docker-compose down
  ```
- **View logs:**
  ```bash
  docker-compose logs -f instance
  ```
- **Rebuild and restart:**
  ```bash
  docker-compose down && docker-compose build && docker-compose up -d
  ```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. If there are any bugs, please open an issue.

If you have any suggestions or ideas, feel free to open an issue.

**New to contributing?**

To get started, fork the repo, make your changes, add, commit, and push your changes to your fork. Then, open a pull request. If you're new to GitHub, [this tutorial](https://www.freecodecamp.org/news/how-to-make-your-first-pull-request-on-github-3#let-s-make-our-first-pull-request-) might help.

You can support the project by giving it a star, sharing it with your friends, contributing to the project, and reporting any bugs you find.

## Buy Me a Coffee
If this repo is useful to you, you can support me by buying me a coffee. Thank you!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/torikushiii)
