const cookies = [
	"cookie_account_1",
	"cookie_account_2"
];

const stuff = [];
for (const cookie of cookies) {
	const cookieObj = {};
	const cookieArr = cookie.split("; ");
	for (const cookieItem of cookieArr) {
		const [key, value] = cookieItem.split("=");
		cookieObj[key.trim()] = value;
	}
	stuff.push({
		cookie: {
			token: cookieObj.cookie_token_v2,
			mid: cookieObj.account_mid_v2,
			ltuid: cookieObj.account_id_v2
		}
	});
}

console.log(stuff);
