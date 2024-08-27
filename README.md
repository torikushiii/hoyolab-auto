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
- [Google App Script](#google-app-script)
- [Supported Games](#supported-games)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Migration](#migration)
- [Usage](#usage)
- [Notifications Setup](#notifications-setup)
- [Running with Docker](#running-with-docker)

## Google App Script
If you don't have a server to run this script and simply just want to use it for checking in, you can use Google App Script.
  - [Google App Script](https://github.com/torikushiii/hoyolab-auto/tree/main/services)

## Supported Games
- [x] Honkai Impact 3rd (Daily Check-In only)
- [x] Tears of Themis (Daily Check-In only)
- [x] Genshin Impact
- [x] Honkai: Star Rail
- [x] Zenless Zone Zero

## Features
- **Honkai Impact 3rd**:
  - **Daily check-in**: Runs every midnight local time.

- **Tears of Themis**:
  - **Daily check-in**: Runs every midnight local time.

- **Genshin Impact**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies, such as commissions if you haven't done them at 09:00 (local time).
  - **Weeklies**: Reminds you to do your weekly bosses/discounted resin if you haven't done them at 09:00 (local time).
  - **Stamina check**: Reminds you to spend your resin if you're at your set threshold or capped.
  - **Expedition check**: Check your expeditions and sends a notification if they're done.
  - **Realm currency**: Sends a notification if your realm currency is capped.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Traveler's Diary**: Check your monthly currency income.
- **Honkai: Star Rail**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies, such as commissions if you haven't done them at 09:00 (local time).
  - **Stamina check**: Reminds you to spend your stamina if you're at your set threshold or capped.
  - **Expedition check**: Check your expeditions and sends a notification if they're done.
  - **Code Redeems**: Search for codes and redeem them automatically.
  - **Trailblazer Monthly Calendar**: Check your monthly currency income.
- **Zenless Zone Zero**:
  - **Daily check-in**: Runs every midnight local time.
  - **Dailies**: Reminds you to do your dailies, such as commissions if you haven't done them at 09:00 (local time).
  - **Stamina check**: Reminds you to spend your stamina if you're at your set threshold or capped.
  - **Howl Scracth Card**: Notifies you if you haven't scratched the card for the day at 09:00 (local time).
  - **Shop Status**: Notifies you if the shop has finished selling videos.
  - **Code Redeems**: Search for codes and redeem them automatically.

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

## Notifications Setup
For setting up Discord or Telegram notifications, refer to the [setup folder](https://github.com/torikushiii/hoyolab-auto/tree/main/setup).

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
