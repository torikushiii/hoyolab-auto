const CodeResolver = require("./resolvers/index.js");
const REDEMPTION_LINKS = {
	genshin: "https://genshin.hoyoverse.com/en/gift",
	starrail: "https://hsr.hoyoverse.com/gift"
};

const fetchCodes = async () => {
	const { genshin, starrail } = await CodeResolver.fetchAll();
	if (starrail.length === 0 && genshin.length === 0) {
		return false;
	}

	return { genshin, starrail };
};

const redeemGenshin = async (account, codeData) => {
	const { success, failed } = await CodeResolver.redeemGenshin(account, codeData);
	return { success, failed };
};

const redeemStarRail = async (account, codeData) => {
	const { success, failed } = await CodeResolver.redeemStarRail(account, codeData);
	return { success, failed };
};

const redeemZenless = async (account, codeData) => {
	const { success, failed } = await CodeResolver.redeemZenless(account, codeData);
	return { success, failed };
};

const buildMessage = (status, account, code) => {
	const gameName = account.gameName;
	const messageTitle = status ? "Code Successfully Redeemed!" : "Code Redeem Failed!";
	const redeemLink = `${REDEMPTION_LINKS[account.platform]}?=code=${code.code}`;

	const message = [
		`[${gameName}] (${account.uid}) ${account.nickname}`,
		`${messageTitle}`,
		`Code: ${code.code}`,
		...(status === false ? [`Manually Redeem Here: ${redeemLink}`] : []),
		...(status === true ? [`Rewards: ${code.rewards.join(", ")}`] : [])
	].join("\n");

	const embed = {
		color: account.assets.color,
		title: `${gameName} Code Redeem`,
		description: `(${account.uid}) ${account.nickname}`
		+ `\n${messageTitle}`
		+ `Code: ${code.code}`
		+ `${status === false ? `\nManually Redeem Here: ${redeemLink}` : ""}`
		+ `${status === true ? `\nRewards: ${code.rewards.join(", ")}` : ""}`,
		timestamp: new Date()
	};

	return {
		telegram: message,
		embed
	};
};

module.exports = {
	fetchCodes,
	redeemGenshin,
	redeemStarRail,
	redeemZenless,
	buildMessage
};
