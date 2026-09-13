const failedRefreshes = new Set();

const notify = async (result, recovered) => {
	const accountId = result.account.ltuid;
	const title = recovered ? "HoYoLAB Cookie Refresh Restored" : "HoYoLAB Cookie Refresh Failed";
	const description = recovered
		? `Cookie refresh is working again for HoYoLAB account ${accountId}.`
		: `Could not refresh the cookie for HoYoLAB account ${accountId}. Automatic code redemption may stop when the current cookie is no longer valid.`;
	const platforms = app.Platform.getForAccount(result.account);

	for (const telegram of platforms.filter(platform => platform.name === "telegram")) {
		await telegram.send(app.Utils.escapeCharacters(`${title}\n\n${description}`));
	}
	for (const webhook of platforms.filter(platform => platform.name === "webhook")) {
		await webhook.send({
			color: recovered ? 0x57F287 : 0xED4245,
			title,
			description,
			timestamp: new Date()
		}, {
			content: webhook.createUserMention(result.account.discord)
		});
	}
};

module.exports = {
	name: "update-cookie",
	expression: "0 */2 * * *",
	description: "Update cookie for all accounts",
	code: (async function updateCookie () {
		const results = await app.HoyoLab.refreshCookieAccounts();
		for (const result of results) {
			const accountId = result.account.ltuid;
			if (result.success) {
				if (failedRefreshes.has(accountId)) {
					await notify(result, true);
					failedRefreshes.delete(accountId);
				}
			}
			else if (!failedRefreshes.has(accountId)) {
				await notify(result, false);
				failedRefreshes.add(accountId);
			}
		}
	})
};
