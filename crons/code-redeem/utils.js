const { setTimeout } = require("node:timers/promises");

const fetchCodes = async () => {
	const [genshinRes, starrailRes, zenlessRes] = await Promise.allSettled([
		require("./genshin").fetchData(),
		require("./starrail").fetchData(),
		require("./zenless").fetchData()
	]);

	const genshin = genshinRes.status === "fulfilled" ? genshinRes.value : [];
	const starrail = starrailRes.status === "fulfilled" ? starrailRes.value : [];
	const zenless = zenlessRes.status === "fulfilled" ? zenlessRes.value : [];

	return {
		genshin,
		starrail,
		zenless
	};
};

const checkAndRedeem = async (codes) => {
	const newCodes = await checkCachedCodes(codes);

	if (Object.values(newCodes).every((i) => i.length === 0)) {
		return;
	}

	const success = [];
	const failed = [];

	if (newCodes.genshin.length > 0) {
		const accounts = app.HoyoLab.getActiveAccounts({
			whitelist: ["genshin"]
		});

		for (const account of accounts) {
			if (account.redeemCode === false) {
				continue;
			}

			for (const code of newCodes.genshin) {
				const result = await require("./genshin").redeemCodes(account, code);
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

		const existingCodes = await app.Cache.get("genshin-code") || [];
		await app.Cache.set({
			key: "genshin-code",
			value: [...existingCodes, ...newCodes.genshin.map(c => c.code.toUpperCase())]
		});
	}

	if (newCodes.starrail.length > 0) {
		const accounts = app.HoyoLab.getActiveAccounts({
			whitelist: ["starrail"]
		});

		for (const account of accounts) {
			if (account.redeemCode === false) {
				continue;
			}

			for (const code of newCodes.starrail) {
				const result = await require("./starrail").redeemCodes(account, code);
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

		const existingCodes = await app.Cache.get("starrail-code") || [];
		await app.Cache.set({
			key: "starrail-code",
			value: [...existingCodes, ...newCodes.starrail.map(c => c.code.toUpperCase())]
		});
	}

	if (newCodes.zenless.length > 0) {
		const accounts = app.HoyoLab.getActiveAccounts({
			whitelist: ["nap"]
		});

		for (const account of accounts) {
			if (account.redeemCode === false) {
				continue;
			}

			for (const code of newCodes.zenless) {
				const result = await require("./zenless").redeemCodes(account, code);
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

		const existingCodes = await app.Cache.get("zenless-code") || [];
		await app.Cache.set({
			key: "zenless-code",
			value: [...existingCodes, ...newCodes.zenless.map(c => c.code.toUpperCase())]
		});
	}

	return {
		success,
		failed
	};
};

const REDEMPTION_LINKS = {
	genshin: "https://genshin.hoyoverse.com/en/gift",
	starrail: "https://hsr.hoyoverse.com/gift",
	nap: "https://zenless.hoyoverse.com/redemption"
};

const buildMessage = (status, data) => {
	const gameName = data.account.game.name;
	const messageTitle = status ? "Code Successfully Redeemed!" : `Code Redeem Failed! (${data.reason})`;
	const redeemLink = `${REDEMPTION_LINKS[data.account.platform]}?code=${data.code.code}`;

	const message = [
		`[${gameName}] (${data.account.uid}) ${data.account.nickname}`,
		`\n${messageTitle}`,
		`\nCode: ${data.code.code}`,
		...(status === false ? [`Manually Redeem Here: ${redeemLink}`] : []),
		...(status === true ? [`Rewards: ${data.code.rewards.join(", ")}`] : [])
	].join("\n");

	const embed = {
		color: data.account.assets.color,
		title: `${gameName} Code Redeem`,
		author: {
			name: data.account.assets.author,
			icon_url: data.account.assets.logo
		},
		description: `(${data.account.uid}) ${data.account.nickname}`
		+ `\n${messageTitle}`
		+ `\nCode: ${data.code.code}`
		+ `${status === false ? `\nManually Redeem Here: ${redeemLink}` : ""}`
		+ `${status === true ? `\nRewards: ${data.code.rewards.join(", ")}` : ""}`,
		timestamp: new Date(),
		footer: {
			text: `${data.code.code}`,
			icon_url: data.account.assets.logo
		}
	};

	return {
		telegram: message,
		embed
	};
};

const checkCachedCodes = async (codes) => {
	const genshinCodes = (await app.Cache.get("genshin-code") || []).map(code => code.toUpperCase());
	const starrailCodes = (await app.Cache.get("starrail-code") || []).map(code => code.toUpperCase());
	const zenlessCodes = (await app.Cache.get("zenless-code") || []).map(code => code.toUpperCase());

	const newCodes = {
		genshin: [],
		starrail: [],
		zenless: []
	};

	if (genshinCodes.length === 0 && codes.genshin.length > 0) {
		await app.Cache.set({
			key: "genshin-code",
			value: codes.genshin.map(c => c.code.toUpperCase())
		});
	}
	else if (codes.genshin.length > 0) {
		newCodes.genshin = codes.genshin.filter(code => !genshinCodes.includes(code.code.toUpperCase()));
	}

	if (starrailCodes.length === 0 && codes.starrail.length > 0) {
		await app.Cache.set({
			key: "starrail-code",
			value: codes.starrail.map(c => c.code.toUpperCase())
		});
	}
	else if (codes.starrail.length > 0) {
		newCodes.starrail = codes.starrail.filter(code => !starrailCodes.includes(code.code.toUpperCase()));
	}

	if (zenlessCodes.length === 0 && codes.zenless.length > 0) {
		await app.Cache.set({
			key: "zenless-code",
			value: codes.zenless.map(c => c.code.toUpperCase())
		});
	}
	else if (codes.zenless.length > 0) {
		newCodes.zenless = codes.zenless.filter(code => !zenlessCodes.includes(code.code.toUpperCase()));
	}

	return newCodes;
};

module.exports = {
	fetchCodes,
	checkAndRedeem,
	buildMessage
};
