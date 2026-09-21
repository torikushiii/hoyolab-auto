const config = {
	enableCodeRedemption: false, // Set to true to enable automatic code redemption
	notifyOnRedeemFailure: false, // Set to true to also report codes that failed to redeem
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
function resetAllRedeemedCodes () {
	const properties = PropertiesService.getScriptProperties();
	for (const key of Object.keys(properties.getProperties())) {
		if (key.endsWith("_redeemed_codes")) {
			properties.deleteProperty(key);
		}
	}
	console.log("All stored redeemed codes have been reset.");
}

function viewAllRedeemedCodes () {
	const allCodes = {};
	const properties = PropertiesService.getScriptProperties().getProperties();
	for (const [key, value] of Object.entries(properties)) {
		if (key.endsWith("_redeemed_codes")) {
			allCodes[key] = JSON.parse(value);
		}
	}
	console.log("All redeemed codes:", allCodes);
	return allCodes;
}

const DISCORD_WEBHOOK = null; // Replace with your Discord webhook URL (optional)
const DISCORD_EMBEDS_PER_MESSAGE = 10; // Discord's hard limit per webhook message
const DISCORD_MAX_MESSAGE_CHARS = 6000; // combined embed text allowed in one message
const DISCORD_MAX_RETRIES = 5;
const DISCORD_MAX_BACKOFF_MS = 60000;
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

// Web redemption pages, used to offer a manual fallback when redemption fails
const REDEMPTION_LINKS = {
	genshin: "https://genshin.hoyoverse.com/en/gift",
	starrail: "https://hsr.hoyoverse.com/gift",
	zenless: "https://zenless.hoyoverse.com/redemption"
};

const REDEEM_ERROR_MESSAGES = {
	"-1071": "The provided cookie is either invalid or expired.",
	"-2001": "The code has expired",
	"-2003": "The code is invalid",
	"-2016": "Redemption is in cooldown",
	"-2017": "The code has been used"
};

// Failures worth attempting again on the next run. Anything not listed here is
// treated as final so we stop hammering the API with a code that will never work.
const RETRYABLE_REDEEM_RETCODES = [
	-1071, // cookie invalid or expired
	-2016 // redemption cooldown
];

function isAuthenticationError (data) {
	return [-100, -10001, -1071].includes(data.retcode)
		|| /(?:please\s+)?log\s*in|login/i.test(String(data.message ?? ""));
}

// Store only a cookie fingerprint and alert state, never the cookie itself.
function updateAuthenticationAlert (game, cookie, operation, failed) {
	const accountId = cookie.match(/(?:^|;\s*)ltuid(?:_v2)?=([^;]+)/)?.[1];
	if (!accountId) {
		return;
	}
	const key = `${game.name}_${accountId}_auth_alert`;
	const properties = PropertiesService.getScriptProperties();
	const fingerprint = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cookie)
		.map(byte => (byte & 255).toString(16).padStart(2, "0")).join("");
	const saved = JSON.parse(properties.getProperty(key) || "null");
	const state = saved?.fingerprint === fingerprint ? saved : { fingerprint, operations: [], notified: false };
	state.operations = state.operations.filter(item => item !== operation);
	if (failed) {
		state.operations.push(operation);
	}
	if (state.operations.length === 0) {
		properties.deleteProperty(key);
		return;
	}
	if (failed && !state.notified && DISCORD_WEBHOOK) {
		try {
			state.notified = postDiscordPayload({
				username: game.config.assets.author,
				avatar_url: game.config.assets.icon,
				embeds: [{
					color: 0xED4245,
					title: `${game.fullName} Authentication Failed`,
					description: `HoYoLAB account ${accountId}: ${operation} requires a valid cookie. Replace this account's cookie in the script configuration. Check-in and code redemption use different tokens, so one can work while the other fails.`,
					timestamp: new Date()
				}]
			}) === true;
		}
		catch (e) {
			console.error("Could not deliver authentication alert:", e.message);
		}
	}
	properties.setProperty(key, JSON.stringify(state));
}

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
		this.redemptionAccounts = [];

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

				this.redemptionAccounts.push({ ...accountDetails, cookie });
				const info = await this.getSignInfo(cookie);
				if (!info.success) {
					continue;
				}

				if (info.data.isSigned) {
					updateAuthenticationAlert(this, cookie, "check-in", false);
					console.info(`${this.fullName}:CheckIn`, "Already signed in today");
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

				updateAuthenticationAlert(this, cookie, "check-in", false);
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
				muteHttpExceptions: true,
				headers: {
					"User-Agent": this.userAgent,
					Cookie: cookieData
				}
			};

			const url = `https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard?uid=${ltuid}`;
			const response = await UrlFetchApp.fetch(url, options);
			const data = JSON.parse(response.getContentText());
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

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
				muteHttpExceptions: true,
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
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

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
				muteHttpExceptions: true,
				headers: {
					Cookie: cookieData,
					"x-rpc-signgame": this.getSignGameHeader()
				}
			});
			const data = JSON.parse(response.getContentText());
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

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
				muteHttpExceptions: true,
				headers: {
					Cookie: cookieData,
					"x-rpc-signgame": this.getSignGameHeader()
				}
			});
			const data = JSON.parse(response.getContentText());
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

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
		const redeemedCodes = this.getRedeemedCodes(account);
		const results = [];

		for (const code of codes) {
			if (redeemedCodes.includes(code.code)) {
				console.log(`Code ${code.code} already redeemed for ${this.fullName}`);
				continue;
			}

			const result = await this.redeemCode(account, code);
			Utilities.sleep(6000);

			results.push(result);
			if (result.authenticationFailed) {
				break;
			}

			// Only stop retrying a code once we know the outcome is final. Transient
			// failures (bad cookie, cooldown, network errors) are left unsaved so the
			// next run picks them up again.
			if (!result.retryable) {
				this.saveRedeemedCode(code.code, account);
			}
		}

		return results;
	}

	// Force redemption of all codes regardless of previous redemption status
	async forceRedeemCodes (account) {
		const codes = await this.fetchCodes();
		const results = [];

		for (const code of codes) {
			console.log(`Attempting to redeem code ${code.code} for ${this.fullName}`);
			const result = await this.redeemCode(account, code);
			results.push(result);
			Utilities.sleep(6000);
			if (result.authenticationFailed) {
				break;
			}
		}

		console.log(`Completed forced code redemption for ${this.fullName}`);
		return results;
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

	async redeemCode (account, codeEntry) {
		const code = typeof codeEntry === "string" ? codeEntry : codeEntry.code;
		const rewards = (typeof codeEntry === "object" && Array.isArray(codeEntry.rewards))
			? codeEntry.rewards
			: [];

		const url = this.getRedemptionUrl(account, code);
		const options = {
			method: this.name === "starrail" ? "POST" : "GET",
			muteHttpExceptions: true,
			headers: {
				"User-Agent": this.userAgent,
				Cookie: account.cookie
			}
		};

		try {
			const response = await UrlFetchApp.fetch(url, options);
			const statusCode = response.getResponseCode();

			if (statusCode !== 200) {
				console.error(`Code ${code} redemption for ${this.fullName} returned status ${statusCode}`);
				return {
					code,
					rewards,
					success: false,
					retryable: true,
					message: `Request failed with status ${statusCode}`
				};
			}

			const data = JSON.parse(response.getContentText());

			const authenticationFailed = isAuthenticationError(data);
			if (authenticationFailed || data.retcode === 0 || data.retcode === -2017) {
				updateAuthenticationAlert(this, account.cookie, "code redemption", authenticationFailed);
			}

			// Check for authentication errors and other failures
			if (data.retcode !== 0) {
				if (data.retcode === -1071) {
					console.error(`Authentication error for code ${code} in ${this.fullName}: ${data.message}. Try logging in via incognito mode and get a fresh cookie from there.`);
				}
				else {
					console.error(`Code ${code} redemption failed for ${this.fullName}:`, data);
				}

				return {
					code,
					rewards,
					success: false,
					authenticationFailed,
					retryable: authenticationFailed || RETRYABLE_REDEEM_RETCODES.includes(data.retcode),
					message: REDEEM_ERROR_MESSAGES[data.retcode] || data.message || `Unknown error (retcode ${data.retcode})`
				};
			}

			console.log(`Code ${code} successfully redeemed for ${this.fullName}:`, data);
			return {
				code,
				rewards,
				success: true,
				retryable: false,
				message: "Code redeemed successfully!"
			};
		}
		catch (e) {
			console.error(`Error redeeming code ${code} for ${this.fullName}:`, e);
			return {
				code,
				rewards,
				success: false,
				retryable: true,
				message: e.message
			};
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

	getRedemptionLink () {
		return REDEMPTION_LINKS[this.name] || null;
	}

	getRedeemedCodes (account) {
		const redeemedCodes = PropertiesService.getScriptProperties().getProperty(`${this.name}_${account.region}_${account.uid}_redeemed_codes`);
		return redeemedCodes ? JSON.parse(redeemedCodes) : [];
	}

	saveRedeemedCode (code, account) {
		const redeemedCodes = this.getRedeemedCodes(account);
		redeemedCodes.push(code);
		PropertiesService.getScriptProperties().setProperty(`${this.name}_${account.region}_${account.uid}_redeemed_codes`, JSON.stringify(redeemedCodes));
	}

	delay (ms) {
		Utilities.sleep(ms);
	}
}

function setTimeout (func, timeout) {
	if (timeout && timeout > 0) {
		Utilities.sleep(timeout);
	}
	func();
}

function checkInGame (gameName) {
	const game = new Game(gameName, config[gameName]);

	return game.checkAndExecute()
		.then(async (successes) => {
			console.log(`Successful check-ins for ${gameName}: ${successes.length}`);

			const redeemReports = [];

			// Only attempt code redemption if enabled in config
			if (config.enableCodeRedemption) {
				for (const account of game.redemptionAccounts) {
					if (gameName === "honkai") {
						continue;
					}

					const results = await game.redeemCodes(account);
					redeemReports.push({
						account,
						assets: game.config.assets,
						results
					});
				}
			}
			else {
				console.log(`Code redemption is disabled in config for ${gameName}`);
			}

			if (DISCORD_WEBHOOK) {
				const embeds = successes.filter(Boolean).map(buildCheckInEmbed);

				for (const report of redeemReports) {
					embeds.push(buildCodeRedeemEmbed(game, report.account, report.assets, report.results));
				}

				postDiscordEmbeds(embeds.filter(Boolean), game.config.assets);
			}
			return successes;
		})
		.catch((e) => {
			console.error(`An error occurred during ${gameName} check-in:`, e);
			throw e;
		});
}

function buildCheckInEmbed (success) {
	if (!success) {
		return null;
	}

	return {
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
}

function embedLength (embed) {
	let length = (embed.title || "").length + (embed.footer?.text || "").length + (embed.author?.name || "").length;

	for (const field of embed.fields || []) {
		length += field.name.length + String(field.value).length;
	}

	return length;
}

function chunkEmbeds (embeds) {
	const chunks = [];
	let current = [];
	let used = 0;

	for (const embed of embeds) {
		const length = embedLength(embed);

		if (current.length > 0 && (current.length >= DISCORD_EMBEDS_PER_MESSAGE || used + length > DISCORD_MAX_MESSAGE_CHARS)) {
			chunks.push(current);
			current = [];
			used = 0;
		}

		current.push(embed);
		used += length;
	}

	if (current.length > 0) {
		chunks.push(current);
	}

	return chunks;
}

function postDiscordEmbeds (embeds, assets) {
	if (!DISCORD_WEBHOOK || !Array.isArray(embeds) || embeds.length === 0) {
		return;
	}

	for (const chunk of chunkEmbeds(embeds)) {
		postDiscordPayload({
			embeds: chunk,
			username: assets.author,
			avatar_url: assets.icon
		});
	}
}

function postDiscordPayload (payload) {
	const options = {
		method: "POST",
		contentType: "application/json",
		muteHttpExceptions: true,
		payload: JSON.stringify(payload)
	};

	const url = `${DISCORD_WEBHOOK}?wait=true`;
	for (let attempt = 0; attempt <= DISCORD_MAX_RETRIES; attempt++) {
		const response = UrlFetchApp.fetch(url, options);
		const statusCode = response.getResponseCode();

		if (statusCode < 300) {
			throttleFromHeaders(response);
			return true;
		}

		if (statusCode !== 429) {
			console.error("Discord webhook failed", statusCode, response.getContentText());
			return false;
		}

		const wait = getRetryAfterMs(response, attempt);
		console.warn(`Discord rate limited (attempt ${attempt + 1}/${DISCORD_MAX_RETRIES}), waiting ${wait}ms`);
		Utilities.sleep(wait);
	}

	console.error("Discord webhook gave up after repeated 429 responses.");
	return false;
}

function getDiscordHeader (response, name) {
	const headers = response.getAllHeaders();
	const key = Object.keys(headers).find(header => header.toLowerCase() === name.toLowerCase());
	if (!key) {
		return null;
	}

	const value = headers[key];
	return Array.isArray(value) ? value[0] : value;
}

function getRetryAfterMs (response, attempt) {
	let seconds = Number.parseFloat(getDiscordHeader(response, "Retry-After"));

	if (!Number.isFinite(seconds)) {
		try {
			seconds = Number.parseFloat(JSON.parse(response.getContentText()).retry_after);
		}
		catch (e) {
			seconds = Number.NaN;
		}
	}

	const backoff = Number.isFinite(seconds) ? seconds * 1000 : 2 ** attempt * 1000;
	return Math.min(backoff + Math.random() * 500, DISCORD_MAX_BACKOFF_MS);
}

function throttleFromHeaders (response) {
	if (getDiscordHeader(response, "X-RateLimit-Remaining") !== "0") {
		return;
	}

	const resetAfter = Number.parseFloat(getDiscordHeader(response, "X-RateLimit-Reset-After"));
	if (Number.isFinite(resetAfter) && resetAfter > 0) {
		Utilities.sleep(Math.min(resetAfter * 1000 + 250, DISCORD_MAX_BACKOFF_MS));
	}
}

// Joins one line per code, staying inside Discord's 1024 character field limit.
function formatCodeLines (entries, formatter) {
	const FIELD_LIMIT = 1024;
	const lines = [];
	let used = 0;

	for (const entry of entries) {
		const line = formatter(entry);
		const suffix = `\n…and ${entries.length - lines.length} more`;

		if (used + line.length + 1 > FIELD_LIMIT - suffix.length) {
			lines.push(suffix.trim());
			break;
		}

		lines.push(line);
		used += line.length + 1;
	}

	return lines.join("\n");
}

function truncate (text, limit) {
	return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function buildCodeRedeemEmbed (game, account, assets, results) {
	if (!DISCORD_WEBHOOK || !Array.isArray(results) || results.length === 0) {
		return null;
	}

	const redeemed = results.filter(result => result.success);
	const failed = config.notifyOnRedeemFailure ? results.filter(result => !result.success && !result.authenticationFailed) : [];

	// Nothing new happened for this account - stay quiet rather than sending an empty report.
	if (redeemed.length === 0 && failed.length === 0) {
		return null;
	}

	const fields = [];

	if (redeemed.length > 0) {
		fields.push({
			name: `Redeemed (${redeemed.length})`,
			value: formatCodeLines(redeemed, (result) => (result.rewards.length > 0
				? `\`${result.code}\` — ${truncate(result.rewards.join(", "), 200)}`
				: `\`${result.code}\``)),
			inline: false
		});
	}

	if (failed.length > 0) {
		const redeemLink = game.getRedemptionLink();

		fields.push({
			name: `Failed (${failed.length})`,
			value: formatCodeLines(failed, result => `\`${result.code}\` — ${truncate(result.message, 150)}`),
			inline: false
		});

		if (redeemLink) {
			fields.push({
				name: "Manually Redeem Here",
				value: redeemLink,
				inline: false
			});
		}
	}

	return {
		color: 5793266,
		title: `${assets.game} Code Redemption`,
		author: {
			name: `${account.uid} - ${account.nickname}`,
			icon_url: assets.icon
		},
		fields,
		timestamp: new Date(),
		footer: {
			text: `${assets.game} Code Redemption`
		}
	};
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

function manuallyRedeemCodes (gameName, forceRedeem = false) {
	if (![
		"genshin", "honkai", "starrail", "zenless"
	].includes(gameName)) {
		console.error(`Invalid game name: ${gameName}. Must be one of: genshin, honkai, starrail, zenless`);
		return Promise.reject(new Error(`Invalid game name: ${gameName}`));
	}

	if (gameName === "honkai") {
		console.warn("Code redemption is not supported for Honkai Impact 3rd");
		return Promise.resolve({ success: false, message: "Code redemption is not supported for Honkai Impact 3rd" });
	}

	// Check if code redemption is enabled (can be bypassed with forceRedeem)
	if (!config.enableCodeRedemption && !forceRedeem) {
		console.warn(`Code redemption is disabled in config for ${gameName}. Use forceRedeem=true to bypass.`);
		return Promise.resolve({ success: false, message: "Code redemption is disabled in config" });
	}

	const game = new Game(gameName, config[gameName]);
	const accounts = config[gameName].data;

	if (accounts.length === 0) {
		console.warn(`No ${gameName} accounts provided. Cannot redeem codes.`);
		return Promise.resolve({ success: false, message: `No ${gameName} accounts provided` });
	}

	const embeds = [];
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

			const results = forceRedeem
				? await game.forceRedeemCodes(account)
				: await game.redeemCodes(account);

			const embed = buildCodeRedeemEmbed(game, account, game.config.assets, results);
			if (embed) {
				embeds.push(embed);
			}

			const message = forceRedeem
				? `Force redeemed all codes for ${account.nickname} (${account.uid})`
				: `Redeemed new codes for ${account.nickname} (${account.uid})`;

			return { success: true, account, results, message };
		}
		catch (e) {
			console.error(`Error redeeming codes for ${gameName}:`, e);
			return { success: false, message: e.message };
		}
	})).then((results) => {
		postDiscordEmbeds(embeds, game.config.assets);
		return results;
	});
}

function redeemGenshinCodes () {
	return manuallyRedeemCodes("genshin", false);
}

function redeemStarRailCodes () {
	return manuallyRedeemCodes("starrail", false);
}

function redeemZenlessCodes () {
	return manuallyRedeemCodes("zenless", false);
}
