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

2. **Getting the Cookie:**
   
> [!NOTE]
> Please log in to your Hoyo account using incognito mode before copying the cookie.
   
   - When you are at the check-in page, open the developer console (F12) and go to the "Network" tab (refresh the page if needed).
   - Find the `home` request and click it.

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/672051f5-26a8-4be0-9403-fca30ac3986c)
        
   - Scroll down to the "Request Headers" section and select everything under "cookie" to use in step 2.

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/e4cb8259-aef4-4b2c-9d88-78e30a03b05c)
     
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

   - **Save the Project:** Click on the floppy disk icon to save your project.

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/7c7b36cf-937a-4003-b86e-9f5f74365a68)

### 3. Run the Script

1. **Before Running It:**
   - Make sure to select `checkInAllGames` or the script will not run.

     ![image](https://github.com/torikushiii/hoyolab-auto/assets/21153445/c5caed6d-773e-46d6-a1b5-e6d0c8226c98)

2. **Trigger the Function (Recommended):**
   - In the Apps Script editor, click on the "Triggers" icon (clock symbol) in the left sidebar.
   - Click "+ Add Trigger" and configure:
     - **Function to run:** `checkInGenshin`
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