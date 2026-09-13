// Destinations that received a failure alert and still need a recovery alert.
const failedRefreshes = new Map();

const getDestinations = (accounts) => {
	const destinations = new Map();
	for (const account of accounts) {
		for (const platform of app.Platform.getForAccount(account)) {
			if (platform.name !== "telegram" && platform.name !== "webhook") {
				continue;
			}
			if (!destinations.has(platform.id)) {
				destinations.set(platform.id, { platform, mentions: new Set() });
			}
			if (platform.name === "webhook") {
				const mention = platform.createUserMention(account.discord);
				if (mention) {
					destinations.get(platform.id).mentions.add(mention);
				}
			}
		}
	}
	return destinations;
};

const notify = async (accountId, destination, recovered) => {
	const { platform, mentions } = destination;
	const title = recovered ? "HoYoLAB Cookie Refresh Restored" : "HoYoLAB Cookie Refresh Failed";
	const description = recovered
		? `Cookie refresh is working again for HoYoLAB account ${accountId}.`
		: `Could not refresh the cookie for HoYoLAB account ${accountId}. Automatic code redemption may stop when the current cookie is no longer valid.`;

	if (platform.name === "telegram") {
		await platform.send(app.Utils.escapeCharacters(`${title}\n\n${description}`));
	}
	else {
		await platform.send({
			color: recovered ? 0x57F287 : 0xED4245,
			title,
			description,
			timestamp: new Date()
		}, {
			content: [...mentions].join(" ")
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
			const notified = failedRefreshes.get(accountId) ?? new Set();
			const destinations = getDestinations(result.accounts);
			for (const [id, destination] of destinations) {
				const shouldNotify = result.success ? notified.has(id) : !notified.has(id);
				if (!shouldNotify) {
					continue;
				}
				try {
					await notify(accountId, destination, result.success);
					if (result.success) {
						notified.delete(id);
					}
					else {
						notified.add(id);
					}
				}
				catch (e) {
					app.Logger.error("Cron:UpdateCookie", `Could not notify ${destination.platform.name} (${id}) for HoYoLAB account ${accountId}: ${e.message}`);
				}
			}
			if (notified.size > 0) {
				failedRefreshes.set(accountId, notified);
			}
			else {
				failedRefreshes.delete(accountId);
			}
		}
	})
};
