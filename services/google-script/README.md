# HoyoLab Check-In Helper

## Contents
- [Pre-requisites](#pre-requisites)
- [Setting up](#setting-up)

## Pre-requisites
- Google Account

## Setting up

### 1. Setup in Google Apps Script

1. **Check-In URLs:**
   - [Honkai Impact](https://act.hoyolab.com/bbs/event/signin-bh3/index.html?act_id=e202110291205111)
   - [Genshin Impact](https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481)
   - [Honkai: Star Rail](https://act.hoyolab.com/bbs/event/signin/hkrpg/index.html?act_id=e202303301540311)
   - [Zenless Zone Zero](https://act.hoyolab.com/bbs/event/signin/zzz/e202406031448091.html?act_id=e202406031448091)

2. **Getting the Cookie:**
   - Follow the [HoyoLab Cookie Extraction Guide](https://gist.github.com/torikushiii/59eff33fc8ea89dbc0b2e7652db9d3fd) to obtain the cookie required for both daily check-ins and code redemption.
   - Use an incognito/private browsing window as recommended in the guide to ensure you copy the correct account's cookie.

### 2. Setup in Google Apps Script

1. **Create a New Project:**
   - Go to [https://script.google.com/](https://script.google.com/) (you'll need a Google account).
   - Create a new project by clicking "+ New Project".

2. **Paste the Code:**
   - Replace any existing code in the script editor with the provided Apps Script code. It should look like this:

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/4a0a5a30-c990-41f2-802e-1ba6f45c0c43)

3. **Configuration:**
   - **Paste your `cookie`:** In the config object, add the following (replace placeholders with your actual data):

     ```javascript
     const config = {
       genshin: {
         data: [
           // "account_cookie_1",
           // "account_cookie_2",
           // ... more account cookies
         ]
       },
       honkai: {
         data: [
           // "account_cookie_1",
           // "account_cookie_2",
           // ... more account cookies
         ]
       },
       starrail: {
         data: [
           // "account_cookie_1",
           // "account_cookie_2",
           // ... more account cookies
         ]
       }
     };
     ```

   - **Discord notifications (optional):** Set `DISCORD_WEBHOOK` to your webhook URL to get a Discord message for every check-in.

     ```javascript
     const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/...";
     ```

   - **Automatic code redemption (optional):** Set `enableCodeRedemption` to `true` to redeem new codes on each scheduled run, including when the account has already checked in that day. Not supported for Honkai Impact 3rd.

     ```javascript
     const config = {
       enableCodeRedemption: true,  // redeem new codes automatically
       notifyOnRedeemFailure: false, // also report codes that failed to redeem
       // ...
     };
     ```

     When `DISCORD_WEBHOOK` is set, one summary message is sent per account listing the codes that were redeemed and the rewards they granted. Nothing is sent when there are no new codes. Turn on `notifyOnRedeemFailure` if you also want to hear about codes that failed - this includes a link to redeem them manually. Codes that fail for a temporary reason (expired cookie, redemption cooldown, network errors) are retried on the next run; expired, invalid, and already-used codes are not.

     Authentication failures send a separate Discord alert even when `notifyOnRedeemFailure` is `false`. Check-in and redemption failures are deduplicated per game and HoYoLAB account across runs. A failed delivery is retried; another alert is allowed after the cookie changes or all reported authentication failures recover. After a redemption login error, remaining codes for that account wait until the next run. Other accounts continue normally.

     Check-in and redemption use different tokens, so successful check-in does not prove that redemption credentials are valid. Replace the affected account's cookie when alerted. This Apps Script does not refresh cookies using `stoken`.

     Redeemed codes are now tracked per game account. When updating from a version with shared code history, current codes may be attempted once again for each account because the old history cannot identify which account redeemed them.

   - **Save the Project:** Click on the floppy disk icon to save your project.

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/7c7b36cf-937a-4003-b86e-9f5f74365a68)

### 3. Run the Script

1. **Before Running It:**
   - Make sure to select `checkInAllGames` or the script will not run.

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/c5caed6d-773e-46d6-a1b5-e6d0c8226c98)

2. **Trigger the Function (Recommended):**
   - In the Apps Script editor, click on the "Triggers" icon (clock symbol) in the left sidebar.
   - Click "+ Add Trigger" and configure:
     - **Function to run:** `checkInAllGames`
     - **Event source:** `Time-driven`
     - **Type of time-based trigger:** `Day timer`
     - **Select time:** Set your desired time for daily check-ins.
   - Save the trigger. This will automatically run your script every day at the specified time.

3. **Final Step:**
   - Run the script once manually by clicking the play button in the Apps Script editor to authorize the script.

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/8378f2b9-2532-4e37-8cf7-394bee0f41c3)

### Important Notes

- **Authorization:** The first time you run the script, it will ask for authorization to access your Google account.
- **Logs:** View the execution logs by clicking on the "Executions" icon (play button symbol) in the Apps Script sidebar.
