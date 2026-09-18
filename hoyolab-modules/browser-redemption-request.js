const redemptionRequest = require("./redemption-request.js");
const { getLanguageOnly } = require("../gots/hoyolab-contexts/language.js");

const MISSING_DEVICE_MESSAGE = "Missing _MHYUUID required for browser redemption. Please configure a newly acquired cookie.";

const GAME_CONTRACTS = {
	starrail: {
		gameBiz: "hkrpg_global",
		origin: "https://hsr.hoyoverse.com"
	},
	zenless: {
		gameBiz: "nap_global",
		origin: "https://zenless.hoyoverse.com"
	}
};

const requestBrowserRedemption = (game, accountData, code, url, options = {}) => {
	const deviceUuid = accountData.redemptionDeviceUuid;
	if (typeof deviceUuid !== "string" || deviceUuid.length === 0) {
		return {
			error: MISSING_DEVICE_MESSAGE
		};
	}

	const contract = GAME_CONTRACTS[game];
	// Preserve the controller's normalized auth cookies; a smaller subset is unverified.
	const cookie = `${accountData.cookie}; _MHYUUID=${deviceUuid}`;

	return {
		request: redemptionRequest({
			url,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			json: {
				t: Date.now(),
				lang: getLanguageOnly(),
				game_biz: contract.gameBiz,
				uid: accountData.uid,
				region: accountData.region,
				cdkey: code,
				platform: "4",
				device_uuid: deviceUuid
			},
			headers: {
				Origin: contract.origin,
				Referer: `${contract.origin}/`,
				Cookie: cookie
			}
		}, { ...options, profile: "HoYoLabDesktopWeb" })
	};
};

module.exports = { MISSING_DEVICE_MESSAGE, requestBrowserRedemption };
