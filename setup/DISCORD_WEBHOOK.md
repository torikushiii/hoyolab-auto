# Discord Webhooks
This is an **OPTIONAL** feature. If you want to receive a Discord notification when the check-in is successful or any other features that you have enabled, you can create a Discord webhook and paste the value into the `config.js` file.

1. Go to edit channel settings. (Create your own server if you don't have one.)
   ![](https://i.imgur.com/FWfK3My.png)
2. Go to the "Integrations" tab and click on "Create Webhook".
   ![](https://i.imgur.com/DnELZJl.png)
3. Create a name for your webhook and click on "Copy Webhook URL".
   ![](https://i.imgur.com/AkfTTBB.png)
4. Click on "Save Changes".
   ![](https://i.imgur.com/KFYeonU.png)
5. Paste the URL into the `webhook > token` field at the `default.config.js` or `config.js` file.
   ![](https://github.com/torikushiii/hoyolab-auto/assets/21153445/ac66e2a5-4935-40c5-a72f-ea2d5f6f7bbd)
   - And it would look like this
   ```json
   {
       "webhook": {
            enabled: true, // Remember to set this to true
            token: "https://discord.com/api/webhooks/1234567890/ABCDEFGHIJKLMN1234567890"
       }
   }
   ```
6. You should receive a Discord notification when the check-in is successful.
   ![](https://github.com/torikushiii/hoyolab-auto/assets/21153445/74fe6bd9-08b2-4c2e-8bab-e6537aec09af)
7. And if you enable stamina check or expedition check, you should receive a Discord notification when your stamina is above your set threshold or when your expedition is done.
   ![](https://github.com/torikushiii/hoyolab-auto/assets/21153445/a9a39b9a-e2aa-46ce-b8bc-ffce5341ada5)