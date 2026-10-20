const crypto = require("node:crypto");

const APP_LOGIN_SALT = "IZPgfb0dRPtBeLuFkdDznSZ6f4wWt6y2";
const NONCE_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

// Passport SDK signs the serialized JSON body and an empty query, even when
// subsequent middleware adds query fields. This is separate from desktop DS.
const signPassportBody = (body, {
	timestamp = Math.floor(Date.now() / 1000),
	nonce = Array.from({ length: 6 }, () => NONCE_ALPHABET[crypto.randomInt(NONCE_ALPHABET.length)]).join("")
} = {}) => {
	const hash = crypto.createHash("md5")
		.update(`salt=${APP_LOGIN_SALT}&t=${timestamp}&r=${nonce}&b=${body}&q=`)
		.digest("hex");
	return `${timestamp},${nonce},${hash}`;
};

const requestPassportRefresh = (url, cookie) => app.Got("HoYoLabPassport", {
	url,
	method: "POST",
	responseType: "json",
	throwHttpErrors: false,
	body: JSON.stringify({ dst_token_types: [2, 4]}),
	headers: { Cookie: cookie },
	hooks: {
		beforeRequest: [(options) => {
			options.headers.ds = signPassportBody(options.body);
		}]
	}
});

module.exports = { signPassportBody, requestPassportRefresh };
