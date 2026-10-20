/* global PropertiesService, UrlFetchApp, Utilities, HoyoLabI18n, ScriptApp */
const config = {
	language: "en-us", // Software and HoYoLAB language
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
	console.log(t("All stored redeemed codes have been reset."));
}

function viewAllRedeemedCodes () {
	const allCodes = {};
	const properties = PropertiesService.getScriptProperties().getProperties();
	for (const [key, value] of Object.entries(properties)) {
		if (key.endsWith("_redeemed_codes")) {
			allCodes[key] = JSON.parse(value);
		}
	}
	console.log(t("All redeemed codes:"), allCodes);
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
			info: "https://sg-act-public-api.hoyolab.com/event/sol/info",
			home: "https://sg-act-public-api.hoyolab.com/event/sol/home",
			sign: "https://sg-act-public-api.hoyolab.com/event/sol/sign"
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
			info: "https://sg-act-public-api.hoyolab.com/event/mani/info",
			home: "https://sg-act-public-api.hoyolab.com/event/mani/home",
			sign: "https://sg-act-public-api.hoyolab.com/event/mani/sign"
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
			info: "https://sg-act-public-api.hoyolab.com/event/luna/hkrpg/os/info",
			home: "https://sg-act-public-api.hoyolab.com/event/luna/hkrpg/os/home",
			sign: "https://sg-act-public-api.hoyolab.com/event/luna/hkrpg/os/sign"
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
			info: "https://sg-act-public-api.hoyolab.com/event/luna/zzz/os/info",
			home: "https://sg-act-public-api.hoyolab.com/event/luna/zzz/os/home",
			sign: "https://sg-act-public-api.hoyolab.com/event/luna/zzz/os/sign"
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

// Match the operation-specific browser/WebView contracts used by the Node bot.
const HTTP_APP_VERSION = "4.21.0";
const HTTP_DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const HTTP_WEBVIEW_USER_AGENT = `Mozilla/5.0 (Linux; Android 17; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.0.0 Mobile Safari/537.36 miHoYoBBSOversea/${HTTP_APP_VERSION}`;

function getApiLanguage () {
	return config.language || "en-us";
}

function encodeQuery (params) {
	return Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}

// Basic desktop DS is used only by HSR/HI3 discovery, never check-in/redemption.
function generateDesktopDS () {
	const timestamp = Math.floor(Date.now() / 1000);
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	const nonce = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
	const preimage = `salt=6s25p5ox5y14umn1p61aqyyvbvvl3lrt&t=${timestamp}&r=${nonce}`;
	const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, preimage)
		.map(byte => (byte & 255).toString(16).padStart(2, "0")).join("");
	return `${timestamp},${nonce},${digest}`;
}

function isAuthenticationError (data) {
	return [-100, -10001, -1071].includes(data.retcode)
		|| /(?:please\s+)?log\s*in|login/i.test(String(data.message ?? ""));
}

function getAccountId (cookie) {
	return cookie.match(/(?:^|;\s*)ltuid(?:_v2)?=([^;]+)/)?.[1];
}

function saveAccountDetails (game, cookie, details) {
	const accountId = getAccountId(cookie);
	if (!accountId) {
		return;
	}
	const key = `${game.name}_${accountId}_account_details`;
	const value = JSON.stringify({ uid: details.uid, nickname: details.nickname, region: details.region });
	const properties = PropertiesService.getScriptProperties();
	if (properties.getProperty(key) !== value) {
		properties.setProperty(key, value);
	}
}

function getCookieFingerprint (cookie) {
	return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cookie)
		.map(byte => (byte & 255).toString(16).padStart(2, "0")).join("");
}

// Store only a cookie fingerprint and alert state, never the cookie itself.
function updateAuthenticationAlert (game, cookie, operation, failed) {
	const accountId = getAccountId(cookie);
	if (!accountId) {
		return;
	}
	const key = `${game.name}_${accountId}_auth_alert`;
	const properties = PropertiesService.getScriptProperties();
	const fingerprint = getCookieFingerprint(cookie);
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
		const account = JSON.parse(properties.getProperty(`${game.name}_${accountId}_account_details`) || "null");
		const fields = [{ name: "HoYoLAB ID", value: accountId, inline: true }];
		if (account) {
			fields.push(
				{ name: "UID", value: String(account.uid), inline: true },
				{ name: "Nickname", value: account.nickname, inline: true },
				{ name: "Region", value: account.region, inline: true }
			);
		}
		try {
			state.notified = postDiscordPayload({
				username: game.config.assets.author,
				avatar_url: game.config.assets.icon,
				embeds: [{
					color: 0xED4245,
					title: `${game.fullName} Authentication Failed`,
					author: account ? { name: `${account.uid} - ${account.nickname}`, icon_url: game.config.assets.icon } : undefined,
					description: `${operation[0].toUpperCase()}${operation.slice(1)} requires a valid cookie. Replace this account's cookie in the script configuration. Check-in and code redemption use different tokens, so one can work while the other fails.`,
					fields,
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
			console.warn(t `No ${this.fullName} accounts provided. Skipping...`);
			return;
		}
	}

	async checkAndExecute () {
		const accounts = this.data;
		if (accounts.length === 0) {
			console.warn(t `No active accounts found for ${this.fullName}`);
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

				const confirmation = await this.getSignInfo(cookie);
				if (!confirmation.success || confirmation.data.isSigned !== true || confirmation.data.today !== data.today) {
					console.warn(`${this.fullName}:CheckIn`, "Check-in could not be confirmed for today");
					continue;
				}

				updateAuthenticationAlert(this, cookie, "check-in", false);
				console.info(
					`${this.fullName}:CheckIn`,
					t `Today's Reward: ${awardObject.name} x${awardObject.count}`
				);

				success.push({
					platform: this.name,
					total: confirmation.data.total,
					result: t(this.config.successMessage),
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
			const headers = this.getRequestHeaders(cookieData, this.name === "zenless");
			headers["x-rpc-app_version"] = this.name === "zenless" ? HTTP_APP_VERSION : "1.5.0";
			headers["x-rpc-language"] = getApiLanguage();
			if (this.name !== "honkai") {
				headers["x-rpc-platform"] = this.name === "zenless" ? "2" : "4";
			}
			if (this.name === "genshin" || this.name === "zenless") {
				headers["x-rpc-lang"] = getApiLanguage();
			}
			if (this.name !== "zenless") {
				headers["x-rpc-client_type"] = "5";
			}
			if (this.name === "genshin") {
				headers["x-rpc-env"] = "default";
			}
			if (this.name === "starrail" || this.name === "honkai") {
				headers.DS = generateDesktopDS();
			}
			const options = { method: "GET", muteHttpExceptions: true, headers };
			const path = this.name === "honkai" || this.name === "zenless" ? "/game_record" : "/event/game_record";
			const url = `https://sg-act-public-api.hoyolab.com${path}/card/wapi/getGameRecordCard?${encodeQuery({ uid: ltuid })}`;
			const response = await UrlFetchApp.fetch(url, options);
			const data = JSON.parse(response.getContentText());
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				throw new Error(t `Failed to login to ${this.fullName} account: ${JSON.stringify(data)}`);
			}

			const accountData = data.data.list.find(account => account.game_id === this.config.gameId);
			if (!accountData) {
				throw new Error(t `No ${this.fullName} account found for ltuid: ${ltuid}`);
			}

			const details = {
				uid: accountData.game_role_id,
				nickname: accountData.nickname,
				rank: accountData.level,
				region: this.fixRegion(accountData.region)
			};
			saveAccountDetails(this, cookieData, details);
			return details;
		}
		catch (e) {
			console.error(`${this.fullName}:login`, t `Error: ${e.message}`);
			throw e; // Re-throw to be handled by the caller
		}
	}

	async sign (cookieData) {
		try {
			const payload = { act_id: this.config.ACT_ID };
			const headers = this.getCheckInHeaders(cookieData);
			const bodyLanguage = this.name === "starrail" || this.name === "zenless";
			if (bodyLanguage) {
				payload.lang = getApiLanguage();
				headers["x-rpc-client_type"] = "5";
				headers["x-rpc-app_version"] = HTTP_APP_VERSION;
				headers["x-rpc-platform"] = "2";
			}
			else if (this.name === "genshin") {
				headers["x-rpc-platform"] = "4";
			}
			const options = {
				method: "POST",
				muteHttpExceptions: true,
				contentType: "application/json",
				headers,
				payload: JSON.stringify(payload)
			};
			const url = this.config.url.sign + (bodyLanguage ? "" : `?${encodeQuery({ lang: getApiLanguage() })}`);
			const response = UrlFetchApp.fetch(url, options);
			const data = JSON.parse(response.getContentText());
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(`${this.fullName}:sign`, t("Failed to sign in."), data);
				return { success: false };
			}

			return { success: true };
		}
		catch (e) {
			console.error(`${this.fullName}:sign`, t `Error: ${e.message}`);
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
			case "honkai":
				return "bh3";
			default:
				return "";
		}
	}

	async getSignInfo (cookieData) {
		try {
			const url = `${this.config.url.info}?${encodeQuery({ act_id: this.config.ACT_ID, lang: getApiLanguage() })}`;
			const response = await UrlFetchApp.fetch(url, {
				muteHttpExceptions: true,
				headers: this.getCheckInHeaders(cookieData)
			});
			const data = JSON.parse(response.getContentText());
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(
					`${this.fullName}:getSignInfo`,
					t("Failed to get sign info."),
					data
				);
				return { success: false };
			}
			const info = data.data;
			if (!info || typeof info.is_sign !== "boolean" || !Number.isInteger(info.total_sign_day)
				|| info.total_sign_day < (info.is_sign ? 1 : 0) || typeof info.today !== "string" || !info.today) {
				console.warn(`${this.fullName}:getSignInfo`, "Invalid sign info received");
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
			console.error(`${this.fullName}:getSignInfo`, t `Error: ${e.message}`);
			return { success: false };
		}
	}

	async getAwardsData (cookieData) {
		try {
			const url = `${this.config.url.home}?${encodeQuery({ act_id: this.config.ACT_ID, lang: getApiLanguage() })}`;
			const response = await UrlFetchApp.fetch(url, {
				muteHttpExceptions: true,
				headers: this.getCheckInHeaders(cookieData)
			});
			const data = JSON.parse(response.getContentText());
			if (isAuthenticationError(data)) {
				updateAuthenticationAlert(this, cookieData, "check-in", true);
			}

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(
					`${this.fullName}:getAwardsData`,
					t("Failed to get awards data."),
					data
				);
				return { success: false };
			}

			if (data.data.awards.length === 0) {
				console.warn(
					`${this.fullName}:getAwardsData`,
					t("No awards data available.")
				);
			}

			return { success: true, data: data.data.awards };
		}
		catch (e) {
			console.error(
				`${this.fullName}:getAwardsData`,
				t `Error: ${e.message}`
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

	getRequestHeaders (cookie, webview = false) {
		return {
			Accept: "application/json, text/plain, */*",
			Origin: "https://act.hoyolab.com",
			Referer: "https://act.hoyolab.com/",
			"User-Agent": webview ? HTTP_WEBVIEW_USER_AGENT : HTTP_DESKTOP_USER_AGENT,
			Cookie: cookie,
			...(webview ? { "x-requested-with": "com.mihoyo.hoyolab" } : {})
		};
	}

	getCheckInHeaders (cookie) {
		return { ...this.getRequestHeaders(cookie, this.name !== "genshin"), "x-rpc-signgame": this.getSignGameHeader() };
	}

	getAccountLabel (account) {
		return `${this.fullName} (${account.nickname} - ${account.uid})`;
	}

	async redeemCodes (account) {
		const codes = await this.fetchCodes();
		const redeemedCodes = this.getRedeemedCodes(account);
		const results = [];

		for (const [index, code] of codes.entries()) {
			if (redeemedCodes.includes(code.code)) {
				console.log(t `Code ${code.code} already redeemed for ${this.getAccountLabel(account)}`);
				continue;
			}

			const result = await this.redeemCode(account, code);
			Utilities.sleep(6000);

			results.push(result);
			if (result.authenticationFailed) {
				const pending = codes.slice(index).filter(entry => !redeemedCodes.includes(entry.code));
				for (const entry of this.takeUnnotifiedPausedCodes(account, pending)) {
					results.push({ code: entry.code, rewards: Array.isArray(entry.rewards) ? entry.rewards : [], success: false, paused: true });
				}
				break;
			}

			if (result.success || !result.retryable) {
				PropertiesService.getScriptProperties().deleteProperty(this.getPausedCodesKey(account));
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
			console.log(t `Attempting to redeem code ${code.code} for ${this.getAccountLabel(account)}`);
			const result = await this.redeemCode(account, code);
			results.push(result);
			Utilities.sleep(6000);
			if (result.authenticationFailed) {
				break;
			}
		}

		console.log(t `Completed forced code redemption for ${this.getAccountLabel(account)}`);
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
			default: throw new Error(t `Unknown game: ${this.name}`);
		}
	}

	async redeemCode (account, codeEntry) {
		const code = typeof codeEntry === "string" ? codeEntry : codeEntry.code;
		const target = this.getAccountLabel(account);
		const rewards = (typeof codeEntry === "object" && Array.isArray(codeEntry.rewards))
			? codeEntry.rewards
			: [];

		const request = this.getRedemptionRequest(account, code);
		if (request.error) {
			return { code, rewards, success: false, retryable: true, message: request.error };
		}

		try {
			const response = await UrlFetchApp.fetch(request.url, request.options);
			const statusCode = response.getResponseCode();

			if (statusCode !== 200) {
				console.error(t `Code ${code} redemption for ${target} returned status ${statusCode}`);
				return {
					code,
					rewards,
					success: false,
					retryable: true,
					message: t `Request failed with status ${statusCode}`
				};
			}

			const data = JSON.parse(response.getContentText());

			const authenticationFailed = isAuthenticationError(data);
			if (authenticationFailed || [0, -2006, -2017].includes(data.retcode)) {
				updateAuthenticationAlert(this, account.cookie, "code redemption", authenticationFailed);
			}

			// Check for authentication errors and other failures
			if (data.retcode !== 0) {
				if (data.retcode === -1071) {
					console.error(t `Authentication error for code ${code} in ${target}: ${data.message}. Try logging in via incognito mode and get a fresh cookie from there.`);
				}
				else {
					console.error(t `Code ${code} redemption failed for ${target}:`, data);
				}

				return {
					code,
					rewards,
					success: false,
					authenticationFailed,
					retryable: authenticationFailed || RETRYABLE_REDEEM_RETCODES.includes(data.retcode),
					message: (REDEEM_ERROR_MESSAGES[data.retcode] && t(REDEEM_ERROR_MESSAGES[data.retcode])) || data.message || t `Unknown error (retcode ${data.retcode})`
				};
			}

			console.log(t `Code ${code} successfully redeemed for ${target}:`, data);
			return {
				code,
				rewards,
				success: true,
				retryable: false,
				message: t("Code redeemed successfully!")
			};
		}
		catch (e) {
			console.error(t `Error redeeming code ${code} for ${target}:`, e);
			return {
				code,
				rewards,
				success: false,
				retryable: true,
				message: e.message
			};
		}
	}

	getRedemptionRequest (account, code) {
		const lang = getApiLanguage().split("-")[0];
		const region = this.mapToInternalRegion(account.region);
		const origin = {
			genshin: "https://genshin.hoyoverse.com",
			starrail: "https://hsr.hoyoverse.com",
			zenless: "https://zenless.hoyoverse.com"
		}[this.name];
		const headers = { ...this.getRequestHeaders(account.cookie), Origin: origin, Referer: `${origin}/` };
		const options = { method: "GET", muteHttpExceptions: true, headers };
		const params = {
			uid: account.uid,
			region,
			cdkey: code,
			game_biz: { genshin: "hk4e_global", starrail: "hkrpg_global", zenless: "nap_global" }[this.name],
			lang
		};
		const url = this.getBaseRedemptionUrl();
		if (this.name === "genshin") {
			return { url: `${url}?${encodeQuery({ ...params, sLangKey: "en-us" })}`, options };
		}
		const deviceUuid = account.cookie.match(/(?:^|;\s*)_MHYUUID=([^;]+)/)?.[1];
		if (!deviceUuid) {
			return { error: "Missing _MHYUUID required for browser redemption. Please configure a newly acquired cookie." };
		}
		return {
			url,
			options: {
				...options,
				method: "POST",
				contentType: "application/json",
				payload: JSON.stringify({ t: Date.now(), ...params, platform: "4", device_uuid: deviceUuid })
			}
		};
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
			throw new Error(t `Unknown game: ${this.name}`);
		}

		const internalRegion = gameMapping[region];
		if (!internalRegion) {
			throw new Error(t `Unknown region ${region} for game ${this.name}`);
		}

		return internalRegion;
	}

	getBaseRedemptionUrl () {
		switch (this.name) {
			case "genshin": return "https://public-operation-hk4e.hoyoverse.com/common/apicdkey/api/webExchangeCdkey";
			case "starrail": return "https://public-operation-hkrpg.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk";
			case "zenless": return "https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk";
			default: throw new Error(t `Unknown game: ${this.name}`);
		}
	}

	getRedemptionLink () {
		return REDEMPTION_LINKS[this.name] || null;
	}

	getPausedCodesKey (account) {
		return `${this.name}_${account.region}_${account.uid}_paused_codes`;
	}

	takeUnnotifiedPausedCodes (account, codes) {
		const properties = PropertiesService.getScriptProperties();
		const key = this.getPausedCodesKey(account);
		const fingerprint = getCookieFingerprint(account.cookie);
		const saved = JSON.parse(properties.getProperty(key) || "null");
		const notified = saved?.fingerprint === fingerprint ? saved.codes : [];
		const fresh = codes.filter(entry => !notified.includes(entry.code));
		if (fresh.length > 0) {
			const codesToSave = [...notified, ...fresh.map(entry => entry.code)];
			properties.setProperty(key, JSON.stringify({ fingerprint, codes: codesToSave }));
		}
		return fresh;
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
			console.log(t `Successful check-ins for ${gameName}: ${successes.length}`);

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
				console.log(t `Code redemption is disabled in config for ${gameName}`);
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
			console.error(t `An error occurred during ${gameName} check-in:`, e);
			throw e;
		});
}

function buildCheckInEmbed (success) {
	if (!success) {
		return null;
	}

	return {
		color: 16748258,
		title: t `${success.assets.game} Daily Check-In`,
		author: {
			name: `${success.account.uid} - ${success.account.nickname}`,
			icon_url: success.assets.icon
		},
		fields: [
			{
				name: t("Nickname"),
				value: success.account.nickname,
				inline: true
			},
			{
				name: "UID",
				value: success.account.uid,
				inline: true
			},
			{
				name: t("Rank"),
				value: success.account.rank,
				inline: true
			},
			{
				name: t("Region"),
				value: success.account.region,
				inline: true
			},
			{
				name: t("Today's Reward"),
				value: `${success.award.name} x${success.award.count}`,
				inline: true
			},
			{
				name: t("Total Check-Ins"),
				value: success.total,
				inline: true
			},
			{
				name: t("Result"),
				value: success.result,
				inline: false
			}
		],
		thumbnail: {
			url: success.award.icon
		},
		timestamp: new Date(),
		footer: {
			text: t `${success.assets.game} Daily Check-In`
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
			console.error(t("Discord webhook failed"), statusCode, response.getContentText());
			return false;
		}

		const wait = getRetryAfterMs(response, attempt);
		console.warn(t `Discord rate limited (attempt ${attempt + 1}/${DISCORD_MAX_RETRIES}), waiting ${wait}ms`);
		Utilities.sleep(wait);
	}

	console.error(t("Discord webhook gave up after repeated 429 responses."));
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
		const suffix = t `\n…and ${entries.length - lines.length} more`;

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
	const failed = config.notifyOnRedeemFailure ? results.filter(result => !result.success && !result.authenticationFailed && !result.paused) : [];
	const paused = results.filter(result => result.paused);

	// Nothing new happened for this account - stay quiet rather than sending an empty report.
	if (redeemed.length === 0 && failed.length === 0 && paused.length === 0) {
		return null;
	}

	const fields = [];

	if (redeemed.length > 0) {
		fields.push({
			name: t `Redeemed (${redeemed.length})`,
			value: formatCodeLines(redeemed, (result) => (result.rewards.length > 0
				? `\`${result.code}\` — ${truncate(result.rewards.join(", "), 200)}`
				: `\`${result.code}\``)),
			inline: false
		});
	}

	if (failed.length > 0) {
		fields.push({
			name: t `Failed (${failed.length})`,
			value: formatCodeLines(failed, result => `\`${result.code}\` — ${truncate(result.message, 150)}`),
			inline: false
		});
	}

	if (paused.length > 0) {
		fields.push({
			name: t("Code Redemption Paused - HoYoLAB Login Expired"),
			value: formatCodeLines(paused, (result) => (result.rewards.length > 0
				? `\`${result.code}\` — ${truncate(result.rewards.join(", "), 200)}`
				: `\`${result.code}\``)),
			inline: false
		});
	}

	const redeemLink = game.getRedemptionLink();
	if (redeemLink && (failed.length > 0 || paused.length > 0)) {
		fields.push({
			name: t("Manually Redeem Here"),
			value: redeemLink,
			inline: false
		});
	}

	return {
		color: 5793266,
		title: t `${assets.game} Code Redemption`,
		author: {
			name: `${account.uid} - ${account.nickname}`,
			icon_url: assets.icon
		},
		fields,
		timestamp: new Date(),
		footer: {
			text: t `${assets.game} Code Redemption`
		}
	};
}

// Read-only activity; this does not refresh tokens or guarantee a longer session.
async function keepAliveCookies () {
	for (const gameName of ["genshin", "honkai", "starrail", "zenless"]) {
		const accounts = config[gameName]?.data || [];
		if (accounts.length === 0) {
			continue;
		}
		const game = new Game(gameName, config[gameName]);
		for (const cookie of new Set(accounts)) {
			const result = await game.getSignInfo(cookie);
			if (result.success) {
				updateAuthenticationAlert(game, cookie, "check-in", false);
			}
		}
	}
}

// Run once from the editor to install or replace your keep-alive trigger.
function setupCookieKeepAlive () {
	removeCookieKeepAlive();
	ScriptApp.newTrigger("keepAliveCookies").timeBased().everyHours(6)
		.create();
	console.log("Cookie keep-alive scheduled every six hours.");
}

function removeCookieKeepAlive () {
	for (const trigger of ScriptApp.getProjectTriggers()) {
		if (trigger.getHandlerFunction() === "keepAliveCookies") {
			ScriptApp.deleteTrigger(trigger);
		}
	}
}

function checkInAllGames () {
	const games = ["genshin", "honkai", "starrail", "zenless"];

	return Promise.all(games.map(checkInGame))
		.then((results) => {
			console.log(t("All games checked in successfully"));
			return results.flat();
		})
		.catch((e) => {
			console.error(t("Error during check-in process:"), e);
		});
}

function manuallyRedeemCodes (gameName, forceRedeem = false) {
	if (![
		"genshin", "honkai", "starrail", "zenless"
	].includes(gameName)) {
		console.error(t `Invalid game name: ${gameName}. Must be one of: genshin, honkai, starrail, zenless`);
		return Promise.reject(new Error(t `Invalid game name: ${gameName}`));
	}

	if (gameName === "honkai") {
		console.warn(t("Code redemption is not supported for Honkai Impact 3rd"));
		return Promise.resolve({ success: false, message: t("Code redemption is not supported for Honkai Impact 3rd") });
	}

	// Check if code redemption is enabled (can be bypassed with forceRedeem)
	if (!config.enableCodeRedemption && !forceRedeem) {
		console.warn(t `Code redemption is disabled in config for ${gameName}. Use forceRedeem=true to bypass.`);
		return Promise.resolve({ success: false, message: t("Code redemption is disabled in config") });
	}

	const game = new Game(gameName, config[gameName]);
	const accounts = config[gameName].data;

	if (accounts.length === 0) {
		console.warn(t `No ${gameName} accounts provided. Cannot redeem codes.`);
		return Promise.resolve({ success: false, message: t `No ${gameName} accounts provided` });
	}

	const embeds = [];
	const redeemForAccount = async (cookieData) => {
		try {
			const ltuid = cookieData.match(/ltuid(?:|_v2)=([^;]+)/)[1];
			const accountDetails = await game.getAccountDetails(cookieData, ltuid);

			if (!accountDetails) {
				return { success: false, message: t `Failed to get account details for ${gameName}` };
			}

			const account = {
				uid: accountDetails.uid,
				nickname: accountDetails.nickname,
				rank: accountDetails.rank,
				region: accountDetails.region,
				cookie: cookieData
			};

			console.log(t `Redeeming codes for ${gameName} account: ${account.nickname} (${account.uid})`);

			const results = forceRedeem
				? await game.forceRedeemCodes(account)
				: await game.redeemCodes(account);

			const embed = buildCodeRedeemEmbed(game, account, game.config.assets, results);
			if (embed) {
				embeds.push(embed);
			}

			const message = forceRedeem
				? t `Force redeemed all codes for ${account.nickname} (${account.uid})`
				: t `Redeemed new codes for ${account.nickname} (${account.uid})`;

			return { success: true, account, results, message };
		}
		catch (e) {
			console.error(t `Error redeeming codes for ${gameName}:`, e);
			return { success: false, message: e.message };
		}
	};

	return (async () => {
		const results = [];
		for (const cookieData of accounts) {
			results.push(await redeemForAccount(cookieData));
		}
		postDiscordEmbeds(embeds, game.config.assets);
		return results;
	})();
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

// Uses the same catalog and formatter as the Node.js application and setup page.
function t (message, ...values) {
	// Keep the original single-file English setup working without optional catalogs.
	if (typeof HoyoLabI18n === "undefined") {
		return Array.isArray(message)
			? message.reduce((text, part, index) => text + (index ? String(values[index - 1]) : "") + part, "")
			: message;
	}
	HoyoLabI18n.setLanguage(config.language);
	return HoyoLabI18n.t(message, ...values);
}
