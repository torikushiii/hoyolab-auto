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

## Supported Games
- [x] Honkai Impact 3rd (Daily Check-In only)
- [x] Genshin Impact
- [x] Honkai: Star Rail
- [x] Zenless Zone Zero

## Features
- **Auto check-in**: Runs every midnight local time.
- **Dailies check**: Reminds you to complete your daily tasks, such as daily commissions, at 09:00 local time.
- **Weeklies check**: Reminds you to complete weekly tasks, such as weekly bosses and discounted resin usage, at 09:00 local time.
- **Stamina check**: Monitors your Resin/Stamina every 30 minutes.
  - **Customizable threshold**: Notifies you when your stamina is above your set threshold.
- **Expedition check**: Checks your expeditions every 30 minutes.
- **Shop status**: This will notify you when your shop has finished selling videos (ZZZ Feature).
- **Code Redemption**: Automatically search and redeem codes for supported games.
  - **Genshin Impact**
  - **Honkai: Star Rail**
  - **Zenless Zone Zero**
- **Notifications**:
  - Discord
  - Telegram

## Google App Script
If you don't have a server to run this script and simply just want to use it for checking in, you can use Google App Script.
  - [Google App Script](https://github.com/torikushiii/hoyolab-auto/tree/main/services)

## Prerequisites
- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/)

## Installation
1. Clone the repository.
2. Run `npm install` to install the dependencies.
3. Create a `config.js` or rename `default.config.js` to `config.js`.
4. Follow the instructions in the `default.config.js` or `config.js` file.

## Usage
For a detailed usage guide, refer to this gist: [Cookie Guide](https://gist.github.com/torikushiii/59eff33fc8ea89dbc0b2e7652db9d3fd).

## Notifications Setup
For setting up Discord or Telegram notifications, refer to the [setup folder](https://github.com/torikushiii/hoyolab-auto/tree/main/setup).

## Docker
You can also run this script using Docker.

### How to run
For the application to work, the configuration file must be mounted under `/app/config.js` or `/app/default.config.js` and `app/data`, respectively (refer to `docker-compose.yml`).

  1. Prepare the configuration file by renaming `default.config.js` to `config.js` and filling in the necessary information.
  2. Build the Docker image:
      ```bash
      docker compose build
      ```
      or if you want to build without cache:
      ```bash
      docker compose build --no-cache
      ```
  3. Start the Docker container:
      ```bash
      docker compose up -d
      ```
  4. Check the logs:
      ```bash
      docker compose logs -f
      ```
  5. To stop the Docker container:
      ```bash
      docker compose down
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
