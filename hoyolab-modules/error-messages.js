const errorMessages = {
	1009: "The account does not exist",
	"-100": "The provided cookie is either invalid or expired.",
	"-10001": "The provided cookie is either invalid or expired.",
	"-10101": "Cannot get data after more than 30 accounts per cookie per day.",
	"-1048": "API system is busy, please try again later.",
	"-1071": "The provided cookie is either invalid or expired.",
	"-2001": "The code has expired",
	"-2003": "The code is invalid",
	"-2016": "Redemption is in cooldown",
	"-2017": "The code has been used"
};

const CaptchaCodes = [
	10035,
	5003,
	10041,
	1034
];

const BattleRecords = (type) => {
	const records = {
		genshin: "https://act.hoyolab.com/app/community-game-records-sea/m.html",
		starrail: "https://act.hoyolab.com/app/community-game-records-sea/rpg/index.html",
		nap: "https://act.hoyolab.com/app/mihoyo-zzz-game-record/index.html"
	};

	return records[type];
};

const errorMessage = (type, code) => {
	const isCaptcha = CaptchaCodes.includes(code);
	if (isCaptcha) {
		const message = app.Utils.tag.trim `
            Your account is currently encountered with a captcha challenge.
            Please solve the captcha by visiting the following link to solve the challenge:
            ${BattleRecords(type)}
        `;

		return message;
	}

	return errorMessages[code];
};

module.exports = errorMessage;
