<h1 align="center">
    <img width="120" height="120" src="https://i.ibb.co/nRqTkXv/image.png" alt=""><br>
    HoyoLab Auto
</h1>

<p align="center">
   <img src="https://img.shields.io/badge/NodeJS-20.2.0-green">
   <img src="https://img.shields.io/github/license/torikushiii/hoyolab-auto">
   <img src="https://img.shields.io/github/stars/torikushiii/hoyolab-auto">
</p>

# HoyoLab Auto

A multi-purpose tool for any supported Hoyoverse games. This tool is designed to help you with your daily check-in, stamina check, expedition check, automatic code-redemption, and more.

# Supported Games
- [x] Honkai Impact 3rd (Daily Check-In only)
- [x] Genshin Impact
- [x] Honkai: Star Rail

# Features
- [x] Auto check-in (Runs every midnight your local time)
- [x] Dailies check
    - This feature will reminds you to do your dailies, such as completing your daily commissions. Defaulted to 09:00 your local time.
- [x] Weeklies check
    - This feature will reminds you to do your weeklies, such as completing your weekly bosses, use your discounted resin, simulated universe, etc. Defaulted to 09:00 your local time.
- [x] Stamina check (Check your Resin/Stamina every 30 minutes)
    - [x] Customizable threshold
        - This feature will notify you when your stamina is above your set threshold.
- [x] Expedition check (Check your expedition every 30 minutes)
- [x] Notification
    - [x] Discord
    - [x] Telegram


# Pre-requisites
- [Node.js](https://nodejs.org/en/)

# Installation
1. Clone the repository.
2. Run `npm install` to install the dependencies.
3. Create a `config.js` or rename `default.config.js` to `config.js`.
4. Follow the instructions in the `default.config.js` or `config.js` file.

# Usage
1. Go to your HoyoLab profile [here](https://www.hoyolab.com/accountCenter/postList).
2. Log in with your Hoyoverse account.
3. Open the browser console (F12).
4. Click on the "Network" tab.
5. Refresh the page.
6. Search for `getGameRecordCard` and click on it.
    ![](https://github.com/torikushiii/hoyolab-auto/assets/21153445/e0c37bb0-e1ff-4fda-8584-5b51e9b89c6c)
7. Click on the "Cookies" tab.
8. Look for `account_mid_v2`, `cookie_token_v2`, and `ltuid_v2`.
    ![](https://github.com/torikushiii/hoyolab-auto/assets/21153445/eaa1c456-0fce-4143-90c4-b7dfe4d146c0)
9. Double click the value of each cookie and copy it.
10. Paste the values in your `default.config.js` or `config.js` file.
11. To run the script you must use `npm start` or you will not recieve any console logs (for windows users, you can use either `npm start` or `set DEBUG=* & node index.js`)

# Notifications
For Discord notifications or Telegram setup, refer to this folder: [setup](https://github.com/torikushiii/hoyolab-auto/tree/main/setup)

# Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. If there's any bugs, please open an issue.

If you have any suggestions/ideas, feel free to open an issue.

**New here?**

To get started, fork the repo, make your changes, add, commit and push your changes to your fork, then come back here and open a pull request. If you're new to GitHub, [this tutorial](https://www.freecodecamp.org/news/how-to-make-your-first-pull-request-on-github-3#let-s-make-our-first-pull-request-) may help.

You can support the project by giving it a star, sharing it with your friends, contributing to the project, and report any bugs you find.

# Buy me a coffee
If this repo is useful to you, you can buy me a coffee to support me. Thank you!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/torikushiii)
