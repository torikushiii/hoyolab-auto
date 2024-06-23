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

const DISCORD_WEBHOOK = null; // Replace with your Discord webhook URL (optional)
const DEFAULT_CONSTANTS = {
	genshin: {
		ACT_ID: "e202102251931481",
		successMessage: "Congratulations, Traveler! You have successfully checked in today~",
		signedMessage: "Traveler, you've already checked in today~",
		game: "Genshin Impact",
		assets: {
			author: "Paimon",
			game: "Genshin Impact",
			icon: "https://fastcdn.hoyoverse.com/static-resource-v2/2024/04/12/b700cce2ac4c68a520b15cafa86a03f0_2812765778371293568.png"
		},
		url: {
			info: "https://sg-hk4e-api.hoyolab.com/event/sol/info",
			home: "https://sg-hk4e-api.hoyolab.com/event/sol/home",
			sign: "https://sg-hk4e-api.hoyolab.com/event/sol/sign"
		}
	},
	honkai: {
		ACT_ID: "e202110291205111",
		successMessage: "You have successfully checked in today, Captain~",
		signedMessage: "You've already checked in today, Captain~",
		game: "Honkai Impact 3rd",
		assets: {
			author: "Kiana",
			game: "Honkai Impact 3rd",
			icon: "https://fastcdn.hoyoverse.com/static-resource-v2/2024/02/29/3d96534fd7a35a725f7884e6137346d1_3942255444511793944.png"
		},
		url: {
			info: "https://sg-public-api.hoyolab.com/event/mani/info",
			home: "https://sg-public-api.hoyolab.com/event/mani/home",
			sign: "https://sg-public-api.hoyolab.com/event/mani/sign"
		}
	},
	starrail: {
		ACT_ID: "e202303301540311",
		successMessage: "You have successfully checked in today, Trailblazer~",
		signedMessage: "You've already checked in today, Trailblazer~",
		game: "Honkai: Star Rail",
		assets: {
			author: "PomPom",
			game: "Honkai: Star Rail",
			icon: "https://fastcdn.hoyoverse.com/static-resource-v2/2024/04/12/74330de1ee71ada37bbba7b72775c9d3_1883015313866544428.png"
		},
		url: {
			info: "https://sg-public-api.hoyolab.com/event/luna/os/info",
			home: "https://sg-public-api.hoyolab.com/event/luna/os/home",
			sign: "https://sg-public-api.hoyolab.com/event/luna/os/sign"
		}
	}
};
  
class Game {
	/**
     * @param {string} name - The short name of the game (e.g., "genshin").
     * @param {Object} config - The configuration object for the game.
     */
	constructor (name, config) {
		this.name = name;
		this.fullName = DEFAULT_CONSTANTS[name].game; // Get full name from constants
		this.config = { ...DEFAULT_CONSTANTS[name], ...config.config };
		this.data = config.data || [];
  
		if (this.data.length === 0) {
			console.warn(`No ${this.fullName} accounts provided. Skipping...`);
			return;
		}
	}
  
	async checkAndExecute () {
		const accounts = this.data;
		if (accounts.length === 0) {
			console.warn(`No active accounts found for ${this.fullName}`);
			return [];
		}
  
		const success = [];
		for (const cookie of accounts) {
			try {
				const info = await this.getSignInfo(cookie);
				if (!info.success) {
					continue;
				}
  
				const awardsData = await this.getAwardsData(cookie);
				if (!awardsData.success) {
					continue;
				}
  
				const awards = awardsData.data;
				const data = {
					total: info.data.total,
					today: info.data.today,
					isSigned: info.data.isSigned
				};
  
				if (data.isSigned) {
					console.info(`${this.fullName}:CheckIn`, "Already signed in today");
					continue;
				}
  
				const totalSigned = data.total;
				const awardObject = {
					name: awards[totalSigned].name,
					count: awards[totalSigned].cnt,
					icon: awards[totalSigned].icon
				};
  
				const sign = await this.sign(cookie);
				if (!sign.success) {
					continue;
				}
  
				console.info(
					`${this.fullName}:CheckIn`,
					`Today's Reward: ${awardObject.name} x${awardObject.count}`
				);
  
				success.push({
					platform: this.name,
					total: data.total + 1,
					result: this.config.successMessage,
					assets: { ...this.config.assets },
					award: awardObject
				});
			}
			catch (e) {
				console.error(`${this.fullName}:CheckIn`, e);
			}
		}
  
		return success;
	}
  
	async sign (cookieData) {
		try {
			const payload = { act_id: this.config.ACT_ID };
			const options = {
				method: "POST",
				contentType: "application/json",
				headers: {
					"User-Agent": this.userAgent,
					Cookie: cookieData
				},
				payload: JSON.stringify(payload)
			};
  
			const response = UrlFetchApp.fetch(this.config.url.sign, options);
			const data = JSON.parse(response.getContentText());
  
			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(`${this.fullName}:sign`, "Failed to sign in.", data);
				return { success: false };
			}
  
			return { success: true };
		}
		catch (e) {
			console.error(`${this.fullName}:sign`, `Error: ${e.message}`);
			return { success: false };
		}
	}
  
	async getSignInfo (cookieData) {
		try {
			const url = `${this.config.url.info}?act_id=${this.config.ACT_ID}`;
			const response = await UrlFetchApp.fetch(url, {
				headers: { Cookie: cookieData }
			});
			const data = JSON.parse(response.getContentText());
  
			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(
					`${this.fullName}:getSignInfo`,
					"Failed to get sign info.",
					data
				);
				return { success: false };
			}
  
			return {
				success: true,
				data: {
					total: data.data.total_sign_day,
					today: data.data.today,
					isSigned: data.data.is_sign
				}
			};
		}
		catch (e) {
			console.error(`${this.fullName}:getSignInfo`, `Error: ${e.message}`);
			return { success: false };
		}
	}
  
	async getAwardsData (cookieData) {
		try {
			const url = `${this.config.url.home}?act_id=${this.config.ACT_ID}`;
			const response = await UrlFetchApp.fetch(url, {
				headers: { Cookie: cookieData }
			});
			const data = JSON.parse(response.getContentText());
  
			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(
					`${this.fullName}:getAwardsData`,
					"Failed to get awards data.",
					data
				);
				return { success: false };
			}
  
			if (data.data.awards.length === 0) {
				console.warn(
					`${this.fullName}:getAwardsData`,
					"No awards data available."
				);
			}
  
			return { success: true, data: data.data.awards };
		}
		catch (e) {
			console.error(
				`${this.fullName}:getAwardsData`,
				`Error: ${e.message}`
			);
			return { success: false };
		}
	}
  
	get userAgent () {
		return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36";
	}
}
  
function checkInGame (gameName) {
	const game = new Game(gameName, config[gameName]); // Create a Game instance
  
	game
		.checkAndExecute()
		.then((successes) => {
			console.log("Successful check-ins:", successes);
  
			if (DISCORD_WEBHOOK) {
				for (const success of successes) {
					sendDiscordNotification(success);
				}
			}
		})
		.catch((e) => {
			console.error("An error occurred during check-in:", e);
		});
}
  
function sendDiscordNotification (success) {
	const embed = {
		color: 16748258,
		title: `${success.assets.game} Daily Check-In`,
		author: {
			name: success.assets.author,
			icon_url: success.assets.icon
		},
		description: `Today's Reward: ${success.award.name} x${success.award.count}\nTotal Check-Ins: ${success.total}`,
		thumbnail: {
			url: success.award.icon
		},
		timestamp: new Date(),
		footer: {
			text: `${success.assets.game} Daily Check-In`
		}
	};
  
	UrlFetchApp.fetch(DISCORD_WEBHOOK, {
		method: "POST",
		contentType: "application/json",
		payload: JSON.stringify({
			embeds: [embed],
			username: success.assets.author,
			avatar_url: success.assets.icon
		})
	});
}
  
  
// Example usage: check in for Genshin, Honkai, and Star Rail
function checkInAllGames () {
	checkInGame("genshin");
	checkInGame("honkai");
	checkInGame("starrail");
}
