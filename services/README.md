# HoyoLab Check-In Helper

[Daily Check-In](https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481)

# Contents
- [Pre-requisites](#pre-requisites)
- [Setting-up](#setting-up)
- [Running Automatically](#trigger)

# Pre-requisites
- Google Account

# Setting-up
**1. Setup in Google Apps Script**

   > [!NOTE]
   > Please login to your Hoyo account through incognito mode first before copying the cookie.

   * **Check-In URL:**
     - [Honkai Impact](https://act.hoyolab.com/bbs/event/signin-bh3/index.html?act_id=e202110291205111)
     - [Genshin Impact](https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481)
     - [Honkai: Star Rail](https://act.hoyolab.com/bbs/event/signin/hkrpg/index.html?act_id=e202303301540311)

   * **Getting Cookie:**
      - When you are at the check-in page, open the developer console (F12) and go to the "Network" tab (refresh the page if needed).
      - Find `home` request and click it.
      ![image](https://gist.github.com/assets/21153445/85a820d6-4783-4ceb-87e0-125821348d77)
      - Scroll down to the "Request Headers" section and select everything under "cookie" to use at step 2.
      ![image](https://gist.github.com/assets/21153445/ba9e93c9-3b03-44ec-b2f6-1741ea1c21f8)
     
**2. Setup in Google Apps Script**

   * **New Project:**
     - Go to [https://script.google.com/](https://script.google.com/) (you'll need a Google account).
     - Create a new project (click "+ New Project").

   * **Paste the Code:**
     - Replace any existing code in the script editor with the provided Apps Script code.

   * **Configuration:**
     - **Paste your `cookie`:**  Paste your cookies at the config object, add the following (replace placeholders with your actual data):
     
        ```javascript
        const config = {
            data: [
                { 
                    "your_mihoyo_account_cookie"
                    // Add more account cookies as needed...
                },
            ],
        };
        ```

     - **Save the Project:** Click on the floppy disk icon to save your project.

**3. Run the Script**

   * **Trigger the Function (Recommended):**
     - In the Apps Script editor, click on the "Triggers" icon (clock symbol) in the left sidebar.
     - Click "+ Add Trigger" and configure:
       - **Function to run:** `checkInGenshin`
       - **Events:** `Time-driven`
       - **Time based:** `Day timer` 
       - **Select time:** Set your desired time for daily check-ins.
     - Save the trigger. This will automatically run your script every day at the specified time.

**Important Notes**

   * **Authorization:** The first time you run the script, it will ask for authorization to access your Google account.  
   * **Logs:** View the execution logs by clicking on the "Executions" icon (play button symbol) in the Apps Script sidebar.