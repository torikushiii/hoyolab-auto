const Genshin = require("./genshin");
const StarRail = require("./star-rail");
const ZenlessZoneZero = require("./zenless");
const { setTimeout } = require("node:timers/promises");

const fetchAll = async () => {
	const [genshin, starrail, zenless] = await Promise.all([
		Genshin.fetchAll(),
		StarRail.fetchAll(),
		ZenlessZoneZero.fetchAll()
	]);

	return {
		genshin,
		starrail,
		zenless
	};
};

const redeemGenshin = async (account, codeList) => {
	const success = [];
	const failed = [];

	for (const code of codeList) {
		const cookieData = app.HoyoLab.parseCookie(account.cookie, {
			whitelist: [
				"cookie_token_v2",
				"account_mid_v2",
				"account_id_v2"
			]
		});

		const res = await app.Got("MiHoYo", {
			url: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
			searchParams: {
				uid: account.uid,
				region: account.region,
				lang: "en",
				cdkey: code.code,
				game_biz: "hk4e_global",
				sLangKey: "en-us"
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			throw new app.Error({
				message: "Genshin API returned non-200 status code.",
				args: {
					statusCode: res.statusCode,
					body: res.body
				}
			});
		}

		const retcode = res.body.retcode;
		if (retcode === -2001 || retcode === -2003) {
			app.Logger.debug("CodeRedeem:Genshin", {
				message: "Expired or invalid code",
				args: {
					code
				}
			});
			continue;
		}

		if (retcode !== 0) {
			app.Logger.debug("CodeRedeem:Genshin", {
				message: `Genshin API returned non-zero status code`,
				args: {
					retcode,
					message: res.body
				}
			});

			failed.push(code);
			await setTimeout(7000);
			continue;
		}

		success.push(code);
		await setTimeout(7000);
	}

	return {
		success,
		failed
	};
};

const redeemStarRail = async (account, codeList) => {
	const success = [];
	const failed = [];

	for (const code of codeList) {
		const cookieData = app.HoyoLab.parseCookie(account.cookie, {
			whitelist: [
				"cookie_token_v2",
				"account_mid_v2",
				"account_id_v2"
			]
		});

		const res = await app.Got("MiHoYo", {
			url: "https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				cdkey: code.code,
				game_biz: "hkrpg_global",
				lang: "en",
				region: account.region,
				t: Date.now(),
				uid: account.uid
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			throw new app.Error({
				message: "Star Rail API returned non-200 status code.",
				args: {
					statusCode: res.statusCode,
					body: res.body
				}
			});
		}

		const retcode = res.body.retcode;
		if (retcode === -2001 || retcode === -2003) {
			app.Logger.debug("CodeRedeem:StarRail", {
				message: "Expired or invalid code",
				args: {
					code: code.code
				}
			});
			continue;
		}
		if (retcode !== 0) {
			app.Logger.debug("CodeRedeem:StarRail", {
				message: `Star Rail API returned non-zero status code`,
				args: {
					retcode,
					message: res.body
				}
			});

			failed.push(code);
			await setTimeout(7000);
			continue;
		}

		success.push(code);
		await setTimeout(7000);
	}

	return {
		success,
		failed
	};
};

const redeemZenless = async (account, codeList) => {
	const success = [];
	const failed = [];

	for (const code of codeList) {
		const cookieData = app.HoyoLab.parseCookie(account.cookie, {
			whitelist: [
				"cookie_token_v2",
				"account_mid_v2",
				"account_id_v2"
			]
		});

		const res = await app.Got("MiHoYo", {
			url: "https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
			searchParams: {
				t: Date.now(),
				lang: "en",
				game_biz: "nap_global",
				uid: account.uid,
				region: account.region,
				cdkey: code.code
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			throw new app.Error({
				message: "Zenless API returned non-200 status code.",
				args: {
					statusCode: res.statusCode,
					body: res.body
				}
			});
		}

		const retcode = res.body.retcode;
		if (retcode === -2001 || retcode === -2003) {
			app.Logger.debug("CodeRedeem:Zenless", {
				message: "Expired or invalid code",
				args: {
					code
				}
			});
			continue;
		}

		if (retcode !== 0) {
			app.Logger.debug("CodeRedeem:Zenless", {
				message: `Zenless API returned non-zero status code`,
				args: {
					retcode,
					message: res.body
				}
			});

			failed.push(code);
			await setTimeout(7000);
			continue;
		}

		success.push(code);
		await setTimeout(7000);
	}

	return {
		success,
		failed
	};
};

module.exports = {
	fetchAll,
	redeemGenshin,
	redeemStarRail,
	redeemZenless
};
