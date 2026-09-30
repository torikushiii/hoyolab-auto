const { setTimeout } = require("node:timers/promises");

const { buildMessage, getRedemptionCookieHash } = require("../code-redeem/utils.js");

const GAMES = [
	{
		accountFilter: "genshin",
		cacheKey: "genshin-code",
		modulePath: "../code-redeem/genshin.js",
		code: "GENSHINGIFT"
	},
	{
		accountFilter: "starrail",
		cacheKey: "starrail-code",
		modulePath: "../code-redeem/starrail.js",
		code: "STARRAILGIFT"
	},
	{
		accountFilter: "nap",
		cacheKey: "zenless-code",
		modulePath: "../code-redeem/zenless.js",
		code: "ZENLESSGIFT"
	}
];

const notifyExpiredLogin = async (account, notificationKey) => {
	const message = buildMessage("failed", { account, loginExpired: true });
	const escapedMessage = app.Utils.escapeCharacters(message.telegram);
	const platforms = app.Platform.getForAccount(account);

	const notified = new Set(await app.Cache.get(notificationKey) ?? []);
	for (const platform of platforms.filter(p => ["telegram", "webhook", "gotify"].includes(p.name))) {
		if (notified.has(platform.id)) {
			continue;
		}
		try {
			if (platform.name === "telegram") {
				await platform.send(escapedMessage);
			}
			else {
				await platform.send(message.embed, { content: platform.createUserMention(account.discord) });
			}
			notified.add(platform.id);
			await app.Cache.set({
				key: notificationKey,
				value: [...notified]
			});
		}
		catch (e) {
			app.Logger.error("GiftCodeRedeem", `Could not notify ${platform.name} (${platform.id}) for account ${account.uid}: ${e.message}`);
		}
	}
};

module.exports = {
	name: "gift-code-redeem",
	expression: "0 */3 * * *",
	description: "Silently redeem the permanent gift codes to detect expired redemption cookies.",
	code: (async function giftCodeRedeem () {
		for (const game of GAMES) {
			const accounts = app.HoyoLab.getActiveAccounts({ whitelist: game.accountFilter })
				.filter(account => account.redeemCode !== false);
			if (accounts.length === 0) {
				continue;
			}

			const { redeemCodes } = require(game.modulePath);
			for (const account of accounts) {
				const loginCacheKey = `${game.cacheKey}:${account.region}:${account.uid}:expired-login`;
				const code = { code: game.code };

				let result;
				try {
					result = await redeemCodes(account, code);
					if (!result.success && app.HoyoLab.isExpiredLogin(result.reason) && await app.HoyoLab.refreshStoredCookies(account.cookie)) {
						result = await redeemCodes(account, code);
					}
				}
				catch (e) {
					app.Logger.warn("GiftCodeRedeem", `${game.code} request failed for account ${account.uid}: ${e.message}`);
					await setTimeout(6000);
					continue;
				}

				if (!result.success && app.HoyoLab.isExpiredLogin(result.reason)) {
					const cookieHash = getRedemptionCookieHash(account);
					await app.Cache.set({ key: loginCacheKey, value: cookieHash });
					await notifyExpiredLogin(account, `${loginCacheKey}:${cookieHash}`);
				}
				else if (result.success || result.retcode === -2017) {
					// Successful or already-used codes confirm authentication; other failures do not.
					await app.Cache.delete(loginCacheKey);
				}

				await setTimeout(6000);
			}
		}
	})
};
