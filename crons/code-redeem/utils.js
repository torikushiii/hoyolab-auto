const { setTimeout } = require("node:timers/promises");

const GAME_CONFIG = [
	{
		key: "genshin",
		modulePath: "./genshin",
		cacheKey: "genshin-code",
		accountFilter: "genshin",
		platform: "genshin",
		redeemable: true,
		redemptionLink: "https://genshin.hoyoverse.com/en/gift"
	},
	{
		key: "starrail",
		modulePath: "./starrail",
		cacheKey: "starrail-code",
		accountFilter: "starrail",
		platform: "starrail",
		redeemable: true,
		redemptionLink: "https://hsr.hoyoverse.com/gift"
	},
	{
		key: "zenless",
		modulePath: "./zenless",
		cacheKey: "zenless-code",
		accountFilter: "nap",
		platform: "nap",
		redeemable: true,
		redemptionLink: "https://zenless.hoyoverse.com/redemption"
	},
	{
		key: "honkai",
		modulePath: "./honkai",
		cacheKey: "honkai-code",
		accountFilter: "honkai",
		platform: "honkai",
		redeemable: false,
		manualReason: "Redeem this code via the in-game exchange center."
	},
	{
		key: "tot",
		modulePath: "./tot",
		cacheKey: "tot-code",
		accountFilter: "tot",
		platform: "tot",
		redeemable: false,
		manualReason: "Redeem this code from the in-game Exchange menu."
	}
];

const REDEMPTION_LINKS = GAME_CONFIG.reduce((acc, game) => {
	if (game.redemptionLink) {
		acc[game.platform] = game.redemptionLink;
	}
	return acc;
}, {});

const DEFAULT_MANUAL_REASON = "Redeem this code from within the game client.";

const toUpperCase = (value) => String(value).toUpperCase();
const formatCodeValue = (code) => String(code?.code ?? "").toUpperCase();

const getCachedCodes = async (cacheKey) => {
	const cachedCodes = await app.Cache.get(cacheKey);
	return Array.isArray(cachedCodes) ? cachedCodes.map(toUpperCase) : [];
};

const appendCodesToCache = async (game, codes) => {
	if (!Array.isArray(codes) || codes.length === 0) {
		return;
	}

	const existingCodes = await getCachedCodes(game.cacheKey);
	const codeSet = new Set(existingCodes);

	let hasUpdates = false;
	for (const code of codes) {
		const normalized = formatCodeValue(code);
		if (!normalized) {
			continue;
		}

		if (codeSet.has(normalized)) {
			continue;
		}

		codeSet.add(normalized);
		hasUpdates = true;
	}

	if (!hasUpdates) {
		return;
	}

	await app.Cache.set({
		key: game.cacheKey,
		value: Array.from(codeSet)
	});
};

const fetchCodes = async () => {
	const settled = await Promise.allSettled(
		GAME_CONFIG.map(async (game) => {
			const module = require(game.modulePath);
			return await module.fetchData();
		})
	);

	return settled.reduce((acc, result, index) => {
		const game = GAME_CONFIG[index];

		if (result.status === "fulfilled" && Array.isArray(result.value)) {
			acc[game.key] = result.value;
		}
		else {
			acc[game.key] = [];
		}

		return acc;
	}, {});
};

const checkAndRedeem = async (codes) => {
	const newCodes = await checkCachedCodes(codes);

	if (Object.values(newCodes).every((i) => i.length === 0)) {
		return;
	}

	const success = [];
	const failed = [];
	const manual = [];

	for (const game of GAME_CONFIG) {
		const pendingCodes = newCodes[game.key] ?? [];
		if (pendingCodes.length === 0) {
			continue;
		}

		const accounts = app.HoyoLab.getActiveAccounts({
			whitelist: game.accountFilter
		});

		if (game.redeemable === false) {
			const manualEligibleAccounts = accounts.filter(acc => acc.redeemCode !== false);
			if (manualEligibleAccounts.length > 0) {
				const sampleAccount = manualEligibleAccounts[0];
				const platform = app.HoyoLab.get(sampleAccount.platform ?? game.accountFilter);
				const platformAssets = platform?.config?.assets ?? {};
				const accountAssets = sampleAccount.assets ?? {};

				for (const code of pendingCodes) {
					manual.push({
						gameKey: game.key,
						gameName: sampleAccount.game?.name ?? platformAssets.game ?? game.key.toUpperCase(),
						platform: game.platform,
						assets: {
							color: accountAssets.color ?? platform?.color ?? platformAssets.color ?? 0x5865F2,
							author: accountAssets.author ?? platformAssets.author ?? "HoyoLab Auto",
							logo: accountAssets.logo ?? platform?.logo ?? platformAssets.logo ?? null
						},
						reason: game.manualReason ?? DEFAULT_MANUAL_REASON,
						code
					});
				}
			}

			await appendCodesToCache(game, pendingCodes);
			continue;
		}

		const { redeemCodes } = require(game.modulePath);

		for (const account of accounts) {
			if (account.redeemCode === false) {
				continue;
			}

			for (const code of pendingCodes) {
				const result = await redeemCodes(account, code);
				if (result.success) {
					success.push({ account, code });
				}
				else {
					failed.push({
						account,
						code,
						reason: result.reason
					});
				}

				await setTimeout(6000);
			}
		}

		await appendCodesToCache(game, pendingCodes);
	}

	return {
		success,
		failed,
		manual
	};
};

const buildMessage = (status, data) => {
	const isManual = status === "manual";
	const account = data.account ?? {};
	const assets = account.assets ?? data.assets ?? {};

	const gameName = account.game?.name
		?? data.gameName
		?? (data.gameKey ? data.gameKey.toUpperCase() : (account.platform ? account.platform.toUpperCase() : "Unknown Game"));

	const redeemLinkBase = REDEMPTION_LINKS[data.gameKey ?? data.platform ?? account.platform];
	const redeemLink = redeemLinkBase ? `${redeemLinkBase}?code=${data.code.code}` : null;

	let messageTitle;
	const detailLines = [];
	let includeRewards = false;
	let includeManualLink = false;
	let manualLinkLabel = "Manually Redeem Here";

	switch (status) {
		case "success":
			messageTitle = "Code Successfully Redeemed!";
			includeRewards = true;
			break;
		case "failed":
			messageTitle = `Code Redeem Failed! (${data.reason})`;
			includeManualLink = Boolean(redeemLink);
			break;
		case "manual":
			messageTitle = "Code Found - Manual Redemption Required";
			detailLines.push(data.reason ?? DEFAULT_MANUAL_REASON);
			includeRewards = true;
			includeManualLink = Boolean(redeemLink);
			manualLinkLabel = "Redeem Online";
			break;
		default:
			throw new app.Error({
				message: "Unknown code redeem status received.",
				args: { status }
			});
	}

	const headerLine = isManual
		? `[${gameName}]`
		: `[${gameName}] (${account.uid ?? "Unknown UID"}) ${account.nickname ?? "Unknown"}`;

	const messageParts = [
		headerLine,
		`\n${messageTitle}`
	];

	for (const line of detailLines) {
		messageParts.push(`\n${line}`);
	}

	messageParts.push(`\nCode: ${data.code.code}`);

	if (includeManualLink && redeemLink) {
		messageParts.push(`\n${manualLinkLabel}: ${redeemLink}`);
	}

	if (includeRewards && Array.isArray(data.code.rewards) && data.code.rewards.length > 0) {
		messageParts.push(`\nRewards: ${data.code.rewards.join(", ")}`);
	}

	const embedDescriptionParts = [
		isManual ? null : `(${account.uid ?? "Unknown UID"}) ${account.nickname ?? "Unknown"}`,
		`\n${messageTitle}`,
		...detailLines.map(line => `\n${line}`),
		`\nCode: ${data.code.code}`
	].filter(Boolean);

	if (includeManualLink && redeemLink) {
		embedDescriptionParts.push(`\n${manualLinkLabel}: ${redeemLink}`);
	}

	if (includeRewards && Array.isArray(data.code.rewards) && data.code.rewards.length > 0) {
		embedDescriptionParts.push(`\nRewards: ${data.code.rewards.join(", ")}`);
	}

	const embed = {
		color: assets.color ?? 0x5865F2,
		title: `${gameName} Code Redeem`,
		author: {
			name: assets.author ?? "HoyoLab Auto",
			icon_url: assets.logo ?? null
		},
		description: embedDescriptionParts.join(""),
		timestamp: new Date(),
		footer: {
			text: `${data.code.code}`,
			icon_url: assets.logo ?? null
		}
	};

	return {
		telegram: messageParts.join(""),
		embed
	};
};

const checkCachedCodes = async (codes) => {
	const newCodes = {};

	for (const game of GAME_CONFIG) {
		const incomingCodes = Array.isArray(codes[game.key]) ? codes[game.key] : [];

		if (incomingCodes.length === 0) {
			newCodes[game.key] = [];
			continue;
		}

		const cachedCodes = await getCachedCodes(game.cacheKey);
		if (cachedCodes.length === 0) {
			const cachedValues = incomingCodes
				.map(formatCodeValue)
				.filter(Boolean);

			await app.Cache.set({
				key: game.cacheKey,
				value: cachedValues
			});
			newCodes[game.key] = [];
			continue;
		}

		newCodes[game.key] = incomingCodes.filter((code) => {
			const normalized = formatCodeValue(code);
			return normalized && !cachedCodes.includes(normalized);
		});
	}

	return newCodes;
};

module.exports = {
	fetchCodes,
	checkAndRedeem,
	buildMessage
};
