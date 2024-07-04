const fs = require("node:fs");

const cookies = [
	"cookie_account_1",
	"cookie_account_2" // Remove this line if you only have one account
];

const stuff = cookies.map(cookie => {
	const cookieObj = Object.fromEntries(
		cookie.split("; ")
			.map(cookieItem => cookieItem.split("=").map(part => part.trim()))
	);
	return {
		token: cookieObj.ltoken_v2,
		mid: cookieObj.ltmid_v2,
		ltuid: cookieObj.account_id_v2
	};
});

const text = stuff.reduce((acc, { token, mid, ltuid }, i) => `${acc}Account ${i + 1}:\n` + `token: ${token}\n` + `mid: ${mid}\n` + `ltuid: ${ltuid}\n\n`, "");

fs.writeFileSync("generated-cookie.txt", text);
console.log("Done! Check generated-cookie.txt for the output.");
