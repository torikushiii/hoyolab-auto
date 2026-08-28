module.exports = {
	name: "update-cookie",
	expression: "0 */2 * * *",
	description: "Update cookie for all accounts",
	code: (async function updateCookie () {
		// eslint-disable-next-line object-curly-spacing
		const accounts = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai", "tot"] });
		if (accounts.length === 0) {
			return;
		}

		for (const account of accounts) {
			const platform = app.HoyoLab.get(account.platform);
			const refreshCookie = await platform.updateCookie(account);
			// updateCookie returns { success: false } on failure, which is truthy.
			// Testing the object itself let failures fall through to the destructure
			// below and throw a TypeError.
			if (!refreshCookie?.success) {
				continue;
			}

			const cookieData = app.HoyoLab.parseCookie(account.cookie, {
				blacklist: ["cookie_token", "account_id"]
			});

			const { accountId, token } = refreshCookie.data;
			account.cookie = `${cookieData}; cookie_token=${token}; account_id=${accountId}`;
			platform.update(account);
		}

		app.Logger.debug("Cron:UpdateCookie", "Updated cookie for all accounts");
	})
};
