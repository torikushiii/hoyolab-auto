module.exports = {
	prefix: "-", // Command prefix, if you enable and have Discord bot
	platforms: [
		{
			id: 1,
			active: true,
			type: "discord", // This platform is optional, only use this if you have want to access commands via Discord bot
			botId: "123", // Your Discord bot ID
			token: "(YOUR_DISCORD_BOT_TOKEN)"
		},
		{
			id: 2,
			active: false, // Set to true if you want to enable Telegram bot
			type: "telegram",
			chatId: 123, // You can follow this guide to create a bot: https://github.com/torikushiii/hoyolab-auto/blob/main/setup/TELEGRAM.md
			token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
			disableNotification: false // Set to true if you want to disable notification for Telegram bot (sounds, vibration, etc.)
		},
		{
			id: 3,
			active: true, // Set to true if you want to send notification to Discord webhook
			type: "webhook",
			url: "(YOUR_WEBHOOK_URL)" // You can follow this guide to create a webhook: https://github.com/torikushiii/hoyolab-auto/blob/main/setup/DISCORD_WEBHOOK.md
		}
	],
	accounts: [
		{
			id: 1,
			active: false, // Set to true if you want to enable Honkai Impact 3rd
			type: "honkai",
			data: [
				{
					cookie: {
						// If there's and extra space at the end of the cookie value, please remove it
						// e.g. "token: "testxdxd123    " -> "token: "testxdxd123"
						token: "", // cookie_token_v2
						mid: "", // account_mid_v2
						ltuid: "" // ltuid_v2
					}
				}
			]
		},
		{
			id: 2,
			active: true, // Set to true if you want to enable Genshin Impact
			type: "genshin",
			data: [
				{
					cookie: {
						// If there's and extra space at the end of the cookie value, please remove it
						// e.g. "token: "testxdxd123    " -> "token: "testxdxd123"
						token: "", // cookie_token_v2
						mid: "", // account_mid_v2
						ltuid: "", // ltuid_v2
						// Not required, but you can add it to hopefully avoid captcha if you have multiple accounts
						deviceId: "",
						deviceFp: ""
					},
					// Enable this if you want to automatically redeem codes
					// Please note that if you have multiple accounts in the different regions
					// the code will be redeemed but you won't get the reward
					// so please be careful when enabling this, and only enable it on the account that you want to redeem the code
					redeemCode: false,
					dailiesCheck: true, // Enable this if you want to get reminded to do your daily commissions
					weekliesCheck: true, // Enable this if you want to get reminded to do your weeklies
					stamina: {
						check: false, // Enable this if you want to get notified when your stamina is above the threshold
						threshold: 150, // Your stamina threshold, only fires notification when your stamina is above this value
						persistent: false // Set to true if you want to get notified every time your stamina is above the threshold
					},
					expedition: {
						check: false, // Enable this if you want to get notified when your expedition is done
						persistent: false // Set to true if you want to get notified every time your expedition is done
					}
				}
			]
		},
		{
			id: 3,
			active: true, // Set to true if you want to enable Honkai: Star Rail
			type: "starrail",
			data: [
				// If you have same account for both genshin and starrail
				// You can copy the cookie values from the genshin account
				// Same goes for any other game that will be supported in the future
				// Support multi-account for every type of game
				// Just add another object inside the data array
				// Account #1
				{
					cookie: {
						// If there's and extra space at the end of the cookie value, please remove it
						// e.g. "token: "testxdxd123    " -> "token: "testxdxd123"
						token: "", // cookie_token_v2
						mid: "", // account_mid_v2
						ltuid: "", // ltuid_v2
						// Not required, but you can add it to hopefully avoid captcha if you have multiple accounts
						deviceId: "",
						deviceFp: ""
					},
					redeemCode: false,
					dailiesCheck: true,
					weekliesCheck: true,
					stamina: {
						check: true,
						threshold: 230,
						persistent: true
					},
					expedition: {
						check: true,
						persistent: false
					}
				},
				// Account #2
				// Delete this if you only have one account
				{
					cookie: {
						token: "", // cookie_token_v2
						mid: "", // account_mid_v2
						ltuid: "", // ltuid_v2
						deviceId: "",
						deviceFp: ""
					},
					dailiesCheck: false,
					weekliesCheck: false,
					stamina: {
						check: false,
						threshold: 150,
						persistent: false
					},
					expedition: {
						check: false,
						persistent: false
					}
				}
			]
		}
	]
};
