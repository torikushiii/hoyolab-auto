const Genshin = require("./genshin");
const StarRail = require("./star-rail");
const ZenlessZoneZero = require("./zenless");
const { setTimeout } = require("node:timers/promises");

const TIMEOUT_DURATION = 30_000;
const RETRY_DELAY = 7000;

const fetchAll = async (accounts) => {
	const filteredAccounts = accounts.filter(account => account.redeemCode);

	const fetchPromises = filteredAccounts.map(account => fetchForPlatform(account));

	const results = await Promise.allSettled(fetchPromises);

	return {
		genshin: results.find(result => result.value?.platform === "genshin")?.value?.result ?? [],
		starrail: results.find(result => result.value?.platform === "starrail")?.value?.result ?? [],
		zenless: results.find(result => result.value?.platform === "nap")?.value?.result ?? []
	};
};

const fetchForPlatform = async (account) => {
	try {
		let fetchFunction;
		switch (account.platform) {
			case "genshin":
				fetchFunction = Genshin.fetchAll;
				break;
			case "starrail":
				fetchFunction = StarRail.fetchAll;
				break;
			case "nap":
				fetchFunction = ZenlessZoneZero.fetchAll;
				break;
			default:
				app.Logger.warn(`CodeRedeem:${account.platform}`, `Unsupported platform: ${account.platform}`);
				return null;
		}

		const result = await Promise.race([
			fetchFunction(account),
			new Promise((_, reject) => setTimeout(TIMEOUT_DURATION).then(() => reject(new Error("Fetch operation timed out"))))
		]);

		app.Logger.debug(`CodeRedeem:${account.platform}`, `Fetched ${result.length} codes`);
		return { platform: account.platform, result };
	}
	catch (e) {
		app.Logger.error(`CodeRedeem:${account.platform}`, `Error fetching codes`, e);
		return null;
	}
};

const redeemCode = async (account, code, redeemFunction) => {
	const cookieData = app.HoyoLab.parseCookie(account.cookie, {
		whitelist: [
			"cookie_token_v2",
			"account_mid_v2",
			"account_id_v2",
			"cookie_token",
			"account_id"
		]
	});

	try {
		const res = await Promise.race([
			redeemFunction(account, code, cookieData),
			new Promise((_, reject) => setTimeout(TIMEOUT_DURATION).then(() => reject(new Error("Request timed out"))))
		]);

		if (res.statusCode !== 200) {
			throw new app.Error({
				message: "API returned non-200 status code.",
				args: {
					statusCode: res.statusCode,
					body: res.body
				}
			});
		}

		const retcode = res.body.retcode;
		if (retcode === -2001 || retcode === -2003) {
			app.Logger.log(`CodeRedeem:${account.platform}`, {
				message: "Expired or invalid code",
				args: { code: code.code }
			});
			return null;
		}

		if (retcode !== 0) {
			app.Logger.info(`CodeRedeem:${account.platform}`, `${code.code} ${res.body.message}`);
			return { success: false, reason: res.body.message };
		}

		app.Logger.info(`CodeRedeem:${account.platform}`, `Successfully redeemed code: ${code.code}`);
		return { success: true };
	}
	catch (e) {
		if (e.message === "Request timed out") {
			app.Logger.warn(`CodeRedeem:${account.platform}`, `Code redemption timed out for ${code.code}`);
			return { success: false, reason: "Redemption timed out" };
		}
		else {
			console.error({
				message: `Error redeeming code ${code.code}`,
				error: e
			});
			return { success: false, reason: "Unexpected error occurred" };
		}
	}
};

const redeemCodes = async (account, codeList, redeemFunction) => {
	const success = [];
	const failed = [];

	for (const code of codeList) {
		const result = await redeemCode(account, code, redeemFunction);
		if (result === null) {
			continue;
		}
		if (result.success) {
			success.push(code);
		}
		else {
			failed.push({ ...code, reason: result.reason });
		}
		await setTimeout(RETRY_DELAY);
	}

	app.Logger.info(`CodeRedeem:${account.platform}`, `Redeemed ${success.length} code(s), ${failed.length} failed`);
	return { success, failed };
};

const redeemGenshin = (account, codeList) => redeemCodes(account, codeList, Genshin.redeem);
const redeemStarRail = (account, codeList) => redeemCodes(account, codeList, StarRail.redeem);
const redeemZenless = (account, codeList) => redeemCodes(account, codeList, ZenlessZoneZero.redeem);

module.exports = {
	fetchAll,
	redeemGenshin,
	redeemStarRail,
	redeemZenless
};
