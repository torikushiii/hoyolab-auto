/**
 * Cookie string parsing shared by the HoyoLab modules.
 *
 * Two rules that both callers need and that hand-rolled splits keep getting wrong:
 * pairs are trimmed, so a stray space in a pasted secret does not become part of a
 * key name, and each pair splits on its FIRST "=" only, because cookie values are
 * base64-ish and may contain "=" themselves.
 */

const splitPairs = (cookie, separator = ";") => String(cookie)
	.split(separator)
	.map(pair => pair.trim())
	.filter(pair => pair.length !== 0)
	.map(pair => {
		const index = pair.indexOf("=");
		if (index === -1) {
			return [pair, ""];
		}

		return [pair.slice(0, index), pair.slice(index + 1)];
	});

const parseCookieMap = (cookie, separator = ";") => Object.fromEntries(splitPairs(cookie, separator));

/**
 * Names of the keys the caller wanted that are absent or empty. Names only -
 * never values, since these strings end up in logs.
 */
const missingKeys = (cookieMap, required) => required.filter(key => !cookieMap[key]);

module.exports = {
	splitPairs,
	parseCookieMap,
	missingKeys
};
