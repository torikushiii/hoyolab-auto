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
		url: "https://api.ennead.cc/mihoyo/genshin/codes",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			"User-Agent": version
		}
	});

	if (res.statusCode !== 200) {
		app.Logger.debug("GenshinAPI", {
			statusCode: res.statusCode
		});

		return [];
	}

	const codes = res.body.active;
	if (!Array.isArray(codes)) {
		app.Logger.debug("GenshinAPI", {
			message: "API returned malformed data",
			body: res.body
		});

		return [];
	}

	return codes.map((i) => ({
		code: i.code,
		rewards: i.rewards,
		source: "genshin-api"
	}));
};

const redeemCodes = async (accountData, code) => {
	const Cookie = app.HoyoLab.parseCookie(accountData.cookie, {
		whitelist: ["cookie_token_v2", "account_mid_v2", "account_id_v2", "cookie_token", "account_id"]
	});

	const res = await app.Got("HoYoLab", {
		url: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
		searchParams: {
			uid: accountData.uid,
			region: accountData.region,
			lang: "en",
			cdkey: code.code,
			game_biz: "hk4e_global",
			sLangKey: "en-us"
		},
		headers: { Cookie }
	});

	if (res.statusCode !== 200) {
		throw new app.Error({
			message: "API returned non-200 status code",
			args: {
				statusCode: res.statusCode,
				body: res.body
			}
		});
	}

	const retcode = res.body.retcode;
	if (retcode === -2001 || retcode === -2003) {
		app.Logger.log(`CodeRedeem:Genshin:${accountData.uid}`, {
			code: code.code,
			message: "Expired or invalid code"
		});

		return {
			success: false,
			reason: "Expired or invalid code"
		};
	}

	if (retcode !== 0) {
		app.Logger.info(`CodeRedeem:Genshin:${accountData.uid}`, `${code.code} - ${res.body.message}`);
		return {
			success: false,
			reason: res.body.message
		};
	}

	app.Logger.info(`CodeRedeem:Genshin:${accountData.uid}`, `${code.code} - Redeemed`);
	return {
		success: true
	};
};

module.exports = {
	fetchData,
	redeemCodes
};
