const { t } = require("../../localization/index.js");
const redemptionRequest = require("../redemption-request.js");
const { getLanguage } = require("../../gots/hoyolab-contexts/language.js");

const GAME_BIZ = "nxx_global";
const REGION = "glb_prod_wd01";
const ROLE_URL = "https://api-account-os.hoyoverse.com/account/binding/api/getUserGameRolesOfRegionByCookieToken";
const REDEMPTION_URL = "https://public-operation-common.hoyoverse.com/common/apicdkey/api/webExchangeCdkey";

// The gift widget keeps Chinese variants and uses primary languages otherwise.
const getGiftLanguage = () => {
	const language = getLanguage();
	return language.startsWith("zh-") ? language : language.split("-")[0];
};

const getRole = async (account) => {
	const headers = {
		Origin: "https://tot.hoyoverse.com",
		Referer: "https://tot.hoyoverse.com/",
		Cookie: account.cookie
	};
	const roles = await app.Got("HoYoLabDesktopWeb", {
		url: ROLE_URL,
		method: "GET",
		responseType: "json",
		throwHttpErrors: false,
		searchParams: { t: Date.now(), game_biz: GAME_BIZ, region: REGION },
		headers: { ...headers, "x-rpc-language": getLanguage() }
	});
	if (roles.statusCode !== 200 || roles.body?.retcode !== 0) {
		// Discovery did not evaluate the code: never classify it as a final code error.
		return { success: false, reason: roles.body?.message || t("Could not load the Tears of Themis character. Please try again later.") };
	}
	const list = roles.body.data?.list;
	const role = Array.isArray(list) && list.find(item => item?.game_biz === GAME_BIZ && item.region === REGION
		&& /^\d+$/.test(String(item.game_uid ?? "")) && typeof item.nickname === "string" && item.nickname.trim().length > 0);
	if (!role) {
		return { success: false, reason: t("No linked Tears of Themis character found. Link your game character to this HoYoverse account first.") };
	}
	return { success: true, role };
};

const redeemCode = async (account, code) => {
	const discovery = await getRole(account);
	if (!discovery.success) {
		return discovery;
	}
	const { role } = discovery;
	// A selected game character must not silently change after cookie renewal.
	if (account.redemptionRoleAvailable && String(role.game_uid) !== account.uid) {
		return { success: false, reason: t("The Tears of Themis character has changed. Restart the bot and select the account again.") };
	}

	const res = await redemptionRequest({
		url: REDEMPTION_URL,
		method: "GET",
		responseType: "json",
		throwHttpErrors: false,
		searchParams: {
			t: Date.now(),
			lang: getGiftLanguage(),
			game_biz: GAME_BIZ,
			uid: role.game_uid,
			region: REGION,
			cdkey: code
		},
		headers: {
			Origin: "https://tot.hoyoverse.com",
			Referer: "https://tot.hoyoverse.com/",
			Cookie: account.cookie,
			"x-rpc-language": getGiftLanguage()
		}
	}, { profile: "HoYoLabDesktopWeb", persist: true, queueAccount: account });
	if (res.statusCode !== 200 || typeof res.body?.retcode !== "number") {
		return { success: false, reason: t("Redemption request failed; will retry on the next run.") };
	}
	return res.body.retcode === 0
		? { success: true }
		: { success: false, reason: res.body.message, retcode: res.body.retcode };
};

module.exports = { GAME_BIZ, REGION, ROLE_URL, REDEMPTION_URL, getRole, redeemCode };
