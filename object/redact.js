/**
 * Strips credentials out of strings that are about to be logged.
 *
 * Request URLs carry secrets in this project: the Telegram bot token sits in the
 * path (`/bot<token>/getUpdates`) and redemption codes sit in the `cdkey` query
 * parameter. Debug logging printed both verbatim.
 */

const REDACTED = "<redacted>";

const PATH_PATTERNS = [
	// Telegram puts the bot token in the path segment itself.
	/\/bot[^/\s]+/gi
];

const SECRET_PARAMS = new Set([
	"cdkey",
	"token",
	"access_token",
	"refresh_token",
	"key",
	"api_key",
	"secret",
	"password",
	"cookie"
]);

const redactUrl = (url) => {
	if (typeof url !== "string" || url.length === 0) {
		return url;
	}

	let result = url;
	for (const pattern of PATH_PATTERNS) {
		result = result.replace(pattern, `/bot${REDACTED}`);
	}

	// Rewriting query values by hand rather than via URL, because the input is
	// sometimes a partial or malformed URL and URL would throw on it.
	result = result.replace(/([?&])([^=&]+)=([^&]*)/g, (match, prefix, rawKey, value) => {
		const key = decodeURIComponent(rawKey).toLowerCase();
		if (!SECRET_PARAMS.has(key)) {
			return match;
		}

		return `${prefix}${rawKey}=${REDACTED}`;
	});

	return result;
};

module.exports = {
	REDACTED,
	redactUrl
};
