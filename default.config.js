module.exports = {
	genshin: false, // Enable this if you want to enable check-ins or any other genshin related features
	starrail: false, // Same as above but for Star Rail
	webhook: {
		// Enable this if you want to send notifications to a discord webhook
		// You can follow this guide to create a webhook: https://github.com/torikushiii/hoyolab-auto/blob/main/setup/DISCORD_WEBHOOK.md
		enabled: false,
		token: "https://discord.com/api/webhooks/123456789012345678/ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
	},
	telegram: {
		// Enable this if you want to send notifications to a telegram chat
		// You can follow this guide to create a bot: https://github.com/torikushiii/hoyolab-auto/blob/main/setup/TELEGRAM.md
		enabled: false,
		chatId: 123,
		token: "123:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
		// If this set to true, this will disable Telegram notifications (sounds, vibration, etc.)
		disableNotification: false
	},
	accounts: [
		{
			type: "genshin", // Account type, either genshin or starrail or any other game that will be supported in the future
			data: [
				{
					cookie: {
						// Your "ltoken" and "ltuid" cookie values
						ltoken: "",
						ltuid: ""
					},
					dailiesCheck: false, // Enable this if you want to be reminded to do your dailies
					weekliesCheck: false, // Enable this if you want to be reminded to do your weeklies
					stamina: {
						// Enable this if you want to be notified if your stamina is above the threshold
						check: false,
						// The threshold value
						threshold: 0,
						// Set this to true to keep getting notifications until your stamina is above the threshold
						persistent: false
					},
					expedition: {
						// Enable this if you want to be notified if your expeditions are done
						check: false,
						// Set this to true to keep getting notifications until you collect your expeditions
						persistent: false
					}
				}
			]
		},
		{
			type: "starrail",
			data: [
				{
					cookie: {
						ltoken: "",
						ltuid: ""
					},
					dailiesCheck: true,
					weekliesCheck: true,
					stamina: {
						check: true,
						threshold: 220,
						persistent: true
					},
					expedition: {
						check: true,
						persistent: false
					}
				},
				{
					cookie: {
						ltoken: "",
						ltuid: ""
					},
					dailiesCheck: false,
					weekliesCheck: false,
					stamina: {
						check: false,
						threshold: 0,
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
