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
	},
	zenless: {
		data: [
			// "account_cookie_1",
			// "account_cookie_2",
			// ... more account cookies
		]
	}
};

// Function to reset redeemed codes for all games
function resetAllRedeemedCodes() {
	const games = ["genshin", "honkai", "starrail", "zenless"];
	games.forEach(game => {
		PropertiesService.getScriptProperties().deleteProperty(`${game}_redeemed_codes`);
	});
	console.log("Redeemed codes for all games have been reset.");
}

// Function to view all stored redeemed codes
function viewAllRedeemedCodes() {
	const games = ["genshin", "honkai", "starrail", "zenless"];
	const allCodes = {};

	games.forEach(game => {
		const redeemedCodes = PropertiesService.getScriptProperties().getProperty(`${game}_redeemed_codes`);
		allCodes[game] = redeemedCodes ? JSON.parse(redeemedCodes) : [];
	});

	console.log("All redeemed codes:", allCodes);
	return allCodes;
}

const DISCORD_WEBHOOK = null; // Replace with your Discord webhook URL (optional)
const DEFAULT_CONSTANTS = {
	genshin: {
		ACT_ID: "e202102251931481",
		successMessage: "Congratulations, Traveler! You have successfully checked in today~",
		signedMessage: "Traveler, you've already checked in today~",
		game: "Genshin Impact",
		gameId: 2,
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
		gameId: 1,
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
		gameId: 6,
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
	},
	zenless: {
		ACT_ID: "e202406031448091",
		successMessage: "Congratulations Proxy! You have successfully checked in today!~",
		signedMessage: "You have already checked in today, Proxy!~",
		game: "Zenless Zone Zero",
		gameId: 8,
		assets: {
			author: "Eous",
			game: "Zenless Zone Zero",
			icon: "https://hyl-static-res-prod.hoyolab.com/communityweb/business/nap.png"
		},
		url: {
			info: "https://sg-public-api.hoyolab.com/event/luna/zzz/os/info",
			home: "https://sg-public-api.hoyolab.com/event/luna/zzz/os/home",
			sign: "https://sg-public-api.hoyolab.com/event/luna/zzz/os/sign"
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
				const ltuid = cookie.match(/ltuid(?:|_v2)=([^;]+)/)[1];
				const accountDetails = await this.getAccountDetails(cookie, ltuid);
				if (!accountDetails) {
					continue;
				}

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
					account: {
						uid: accountDetails.uid,
						nickname: accountDetails.nickname,
						rank: accountDetails.rank,
						region: accountDetails.region,
						cookie
					},
					award: awardObject
				});
			}
			catch (e) {
				console.error(`${this.fullName}:CheckIn`, e);
			}
		}

		return success;
	}

	async getAccountDetails (cookieData, ltuid) {
		try {
			const options = {
				method: "GET",
				headers: {
					"User-Agent": this.userAgent,
					Cookie: cookieData
				}
			};

			const url = `https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard?uid=${ltuid}`;
			const response = await UrlFetchApp.fetch(url, options);
			const data = JSON.parse(response.getContentText());

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				throw new Error(`Failed to login to ${this.fullName} account: ${JSON.stringify(data)}`);
			}

			const accountData = data.data.list.find(account => account.game_id === this.config.gameId);
			if (!accountData) {
				throw new Error(`No ${this.fullName} account found for ltuid: ${ltuid}`);
			}

			return {
				uid: accountData.game_role_id,
				nickname: accountData.nickname,
				rank: accountData.level,
				region: this.fixRegion(accountData.region)
			};
		}
		catch (e) {
			console.error(`${this.fullName}:login`, `Error: ${e.message}`);
			throw e; // Re-throw to be handled by the caller
		}
	}

	async sign (cookieData) {
		try {
			const payload = { act_id: this.config.ACT_ID };
			const options = {
				method: "POST",
				contentType: "application/json",
				headers: {
					"User-Agent": this.userAgent,
					Cookie: cookieData,
					"x-rpc-signgame": this.getSignGameHeader()
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

	getSignGameHeader () {
		switch (this.name) {
			case "starrail":
				return "hkrpg";
			case "genshin":
				return "hk4e";
			case "zenless":
				return "zzz";
			default:
				return "";
		}
	}

	async getSignInfo (cookieData) {
		try {
			const url = `${this.config.url.info}?act_id=${this.config.ACT_ID}`;
			const response = await UrlFetchApp.fetch(url, {
				headers: {
					Cookie: cookieData,
					"x-rpc-signgame": this.getSignGameHeader()
				}
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
				headers: {
					Cookie: cookieData,
					"x-rpc-signgame": this.getSignGameHeader()
				}
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

	fixRegion (region) {
		switch (region) {
			case "os_cht":
			case "prod_gf_sg":
			case "prod_official_cht":
				return "TW";
			case "os_asia":
			case "prod_gf_jp":
			case "prod_official_asia":
				return "SEA";
			case "eur01":
			case "os_euro":
			case "prod_gf_eu":
			case "prod_official_eur":
				return "EU";
			case "usa01":
			case "os_usa":
			case "prod_gf_us":
			case "prod_official_usa":
				return "NA";
			default:
				return "Unknown";
		}
	}

	get userAgent () {
		return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
	}

	async redeemCodes (account) {
		const codes = await this.fetchCodes();
		const redeemedCodes = this.getRedeemedCodes();

		for (const code of codes) {
			if (redeemedCodes.includes(code.code)) {
				console.log(`Code ${code.code} already redeemed for ${this.fullName}`);
				continue;
			}

			await this.redeemCode(account, code.code);
			Utilities.sleep(6000);

			this.saveRedeemedCode(code.code);
		}
	}

	// Force redemption of all codes regardless of previous redemption status
	async forceRedeemCodes (account) {
		const codes = await this.fetchCodes();

		for (const code of codes) {
			console.log(`Attempting to redeem code ${code.code} for ${this.fullName}`);
			await this.redeemCode(account, code.code);
			Utilities.sleep(6000);
		}

		console.log(`Completed forced code redemption for ${this.fullName}`);
	}

	async fetchCodes () {
		const gameParam = this.getGameParam();
		const url = `https://api.ennead.cc/mihoyo/${gameParam}/codes`;
		const response = await UrlFetchApp.fetch(url);
		const data = JSON.parse(response.getContentText());
		return data.active;
	}

	getGameParam () {
		switch (this.name) {
			case "genshin": return "genshin";
			case "starrail": return "starrail";
			case "zenless": return "zenless";
			default: throw new Error(`Unknown game: ${this.name}`);
		}
	}

	async redeemCode (account, code) {
		const url = this.getRedemptionUrl(account, code);
		const options = {
			method: this.name === "starrail" ? "POST" : "GET",
			headers: {
				"User-Agent": this.userAgent,
				Cookie: account.cookie
			}
		};

		try {
			const response = await UrlFetchApp.fetch(url, options);
			const data = JSON.parse(response.getContentText());
			console.log(`Code ${code} redemption result for ${this.fullName}:`, data);
		}
		catch (e) {
			console.error(`Error redeeming code ${code} for ${this.fullName}:`, e);
		}
	}

	getRedemptionUrl (account, code) {
		const baseUrl = this.getBaseRedemptionUrl();
		const internalRegion = this.mapToInternalRegion(account.region);
		const params = [
			`t=${Date.now()}`,
			`lang=en`,
			`uid=${account.uid}`,
			`region=${internalRegion}`,
			`cdkey=${code}`
		];

		switch (this.name) {
			case "genshin":
				params.push("sLangKey=en-us", "game_biz=hk4e_global");
				break;
			case "starrail":
				params.push("game_biz=hkrpg_global");
				break;
			case "zenless":
				params.push("game_biz=nap_global");
				break;
		}

		return `${baseUrl}?${params.join("&")}`;
	}

	mapToInternalRegion (region) {
		const regionMappings = {
			genshin: {
				SEA: "os_asia",
				NA: "os_usa",
				EU: "os_euro",
				TW: "os_cht"
			},
			starrail: {
				NA: "prod_official_usa",
				EU: "prod_official_eur",
				SEA: "prod_official_asia",
				TW: "prod_official_cht"
			},
			zenless: {
				TW: "prod_gf_sg",
				SEA: "prod_gf_jp",
				EU: "prod_gf_eu",
				NA: "prod_gf_us"
			}
		};

		const gameMapping = regionMappings[this.name];
		if (!gameMapping) {
			throw new Error(`Unknown game: ${this.name}`);
		}

		const internalRegion = gameMapping[region];
		if (!internalRegion) {
			throw new Error(`Unknown region ${region} for game ${this.name}`);
		}

		return internalRegion;
	}

	getBaseRedemptionUrl () {
		switch (this.name) {
			case "genshin": return "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey";
			case "starrail": return "https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk";
			case "zenless": return "https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey";
			default: throw new Error(`Unknown game: ${this.name}`);
		}
	}

	getRedeemedCodes () {
		const redeemedCodes = PropertiesService.getScriptProperties().getProperty(`${this.name}_redeemed_codes`);
		return redeemedCodes ? JSON.parse(redeemedCodes) : [];
	}

	saveRedeemedCode (code) {
		const redeemedCodes = this.getRedeemedCodes();
		redeemedCodes.push(code);
		PropertiesService.getScriptProperties().setProperty(`${this.name}_redeemed_codes`, JSON.stringify(redeemedCodes));
	}

	delay (ms) {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve();
			}, ms);
		});
	}
}

function setTimeout (func, timeout) {
	const lock = LockService.getScriptLock();
	lock.waitLock(timeout);

	func();

	lock.releaseLock();
}

function checkInGame (gameName) {
	const game = new Game(gameName, config[gameName]);

	return game.checkAndExecute()
		.then(async (successes) => {
			console.log(`Successful check-ins for ${gameName}:`, successes);

			for (const success of successes) {
				if (gameName === "honkai") {
					continue;
				}

				await game.redeemCodes(success.account);
			}

			if (DISCORD_WEBHOOK) {
				return Promise.all(successes.map(sendDiscordNotification));
			}
			return successes;
		})
		.catch((e) => {
			console.error(`An error occurred during ${gameName} check-in:`, e);
			throw e;
		});
}

function sendDiscordNotification (success) {
	const embed = {
		color: 16748258,
		title: `${success.assets.game} Daily Check-In`,
		author: {
			name: `${success.account.uid} - ${success.account.nickname}`,
			icon_url: success.assets.icon
		},
		fields: [
			{
				name: "Nickname",
				value: success.account.nickname,
				inline: true
			},
			{
				name: "UID",
				value: success.account.uid,
				inline: true
			},
			{
				name: "Rank",
				value: success.account.rank,
				inline: true
			},
			{
				name: "Region",
				value: success.account.region,
				inline: true
			},
			{
				name: "Today's Reward",
				value: `${success.award.name} x${success.award.count}`,
				inline: true
			},
			{
				name: "Total Check-Ins",
				value: success.total,
				inline: true
			},
			{
				name: "Result",
				value: success.result,
				inline: false
			}
		],
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

function checkInAllGames () {
	const games = ["genshin", "honkai", "starrail", "zenless"];

	return Promise.all(games.map(checkInGame))
		.then((results) => {
			console.log("All games checked in successfully");
			return results.flat();
		})
		.catch((e) => {
			console.error("Error during check-in process:", e);
		});
}

function manuallyRedeemCodes(gameName, forceRedeem = false) {
	if (!["genshin", "honkai", "starrail", "zenless"].includes(gameName)) {
		console.error(`Invalid game name: ${gameName}. Must be one of: genshin, honkai, starrail, zenless`);
		return Promise.reject(new Error(`Invalid game name: ${gameName}`));
	}

	if (gameName === "honkai") {
		console.warn("Code redemption is not supported for Honkai Impact 3rd");
		return Promise.resolve({ success: false, message: "Code redemption is not supported for Honkai Impact 3rd" });
	}

	const game = new Game(gameName, config[gameName]);
	const accounts = config[gameName].data;

	if (accounts.length === 0) {
		console.warn(`No ${gameName} accounts provided. Cannot redeem codes.`);
		return Promise.resolve({ success: false, message: `No ${gameName} accounts provided` });
	}

	return Promise.all(accounts.map(async (cookieData) => {
		try {
			const ltuid = cookieData.match(/ltuid(?:|_v2)=([^;]+)/)[1];
			const accountDetails = await game.getAccountDetails(cookieData, ltuid);

			if (!accountDetails) {
				return { success: false, message: `Failed to get account details for ${gameName}` };
			}

			const account = {
				uid: accountDetails.uid,
				nickname: accountDetails.nickname,
				rank: accountDetails.rank,
				region: accountDetails.region,
				cookie: cookieData
			};

			console.log(`Redeeming codes for ${gameName} account: ${account.nickname} (${account.uid})`);

			if (forceRedeem) {
				await game.forceRedeemCodes(account);
				return { success: true, account, message: `Force redeemed all codes for ${account.nickname} (${account.uid})` };
			} else {
				await game.redeemCodes(account);
				return { success: true, account, message: `Redeemed new codes for ${account.nickname} (${account.uid})` };
			}
		} catch (e) {
			console.error(`Error redeeming codes for ${gameName}:`, e);
			return { success: false, message: e.message };
		}
	}));
}

function redeemGenshinCodes() {
	return manuallyRedeemCodes("genshin", false);
}

function redeemStarRailCodes() {
	return manuallyRedeemCodes("starrail", false);
}

function redeemZenlessCodes() {
	return manuallyRedeemCodes("zenless", false);
}
