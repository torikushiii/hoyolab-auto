const Genshin = require("./genshin");
const StarRail = require("./star-rail");
const { setTimeout } = require("node:timers/promises");

const fetchAll = async () => {
	const [genshin, starrail] = await Promise.all([
		Genshin.fetchAll(),
		StarRail.fetchAll()
	]);

	return {
		genshin,
		starrail
	};
};

const redeemGenshin = async (account, codeList) => {
	const success = [];
	const failed = [];

	for (const code of codeList) {
		const res = await app.Got({
			url: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
			searchParams: {
				uid: account.uid,
				region: account.region,
				lang: "en",
				cdkey: code,
				game_biz: "hk4e_global"
			}
		});
	}
};

const redeemStarRail = async (account, codeList) => {
	const success = [];
	const failed = [];

	for (const code of codeList) {
		const res = await app.Got({
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
				Cookie: account.cookie
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

		if (res.body.retcode !== 0) {
			app.Logger.json("CodeRedeem:StarRail", {
				message: `Star Rail API returned non-zero status code`,
				args: {
					retcode: res.body.retcode,
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
	redeemStarRail
};
