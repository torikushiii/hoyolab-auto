const { t } = require("../../localization/index.js");
const { requestBrowserRedemption } = require("../../hoyolab-modules/browser-redemption-request.js");

let version;

const fetchData = async () => {
	if (typeof version === "undefined") {
		try {
			const { execSync } = require("child_process");
			const hash = execSync("git rev-parse --short HEAD").toString().trim();

			version = `HoyoLabAuto@${hash}`;
		}
		catch {
			version = "HoyoLabAuto";
		}
	}

	const res = await app.Got("API", {
		url: "https://api.ennead.cc/mihoyo/zenless/codes",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			"User-Agent": version
		}
	});

	if (res.statusCode !== 200) {
		app.Logger.debug("ZenlessAPI", {
			statusCode: res.statusCode
		});

		return [];
	}

	const codes = res.body.active;
	if (!Array.isArray(codes)) {
		app.Logger.debug("ZenlessAPI", {
			message: t("API returned malformed data"),
			body: res.body
		});

		return [];
	}

	return codes.map((i) => ({
		code: i.code,
		rewards: i.rewards,
		source: "zenless-api"
	}));
};

const redeemCodes = async (accountData, code) => {
	const redemption = requestBrowserRedemption("zenless", accountData, code.code, "https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk");
	if (redemption.error) {
		return { success: false, reason: redemption.error };
	}
	const res = await redemption.request;

	if (res.statusCode !== 200) {
		throw new app.Error({
			message: t("API returned non-200 status code"),
			args: {
				statusCode: res.statusCode,
				body: res.body
			}
		});
	}

	const retcode = res.body.retcode;
	if (retcode === -2001 || retcode === -2003) {
		app.Logger.log(`CodeRedeem:Zenless:${accountData.uid}`, {
			code: code.code,
			message: t("Expired or invalid code")
		});

		return {
			success: false,
			reason: t("Expired or invalid code"),
			retcode
		};
	}

	if (retcode !== 0) {
		app.Logger.info(`CodeRedeem:Zenless:${accountData.uid}`, `${code.code} - ${res.body.message}`);
		return {
			success: false,
			reason: res.body.message,
			retcode
		};
	}

	app.Logger.info(`CodeRedeem:Zenless:${accountData.uid}`, t `${code.code} - Redeemed`);
	return {
		success: true
	};
};

module.exports = {
	fetchData,
	redeemCodes
};
