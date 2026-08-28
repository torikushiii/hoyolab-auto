/**
 * Live credential checks against HoYoverse's passport API.
 *
 * The two credential classes in a HoYoLab cookie expire independently, and only
 * code redemption uses the cookie_token class. So redemption can be dead for
 * days while everything else looks healthy. These probes are what the official
 * web pages call to gate the same features, they are pure reads, and they
 * consume nothing.
 *
 * Each probe is sent the fields of ONE class only. That matters: verifyLToken
 * accepts a cookie_token and returns OK, so a probe handed the whole cookie can
 * report health it never actually tested.
 */

const Cookie = require("./cookie.js");

const LTOKEN_FIELDS = ["ltoken_v2", "ltuid_v2", "ltmid_v2"];
const COOKIE_TOKEN_FIELDS = ["cookie_token_v2", "account_mid_v2", "account_id_v2"];

const PASSPORT_HOSTS = {
	EU: "passport-api-eu.hoyoverse.com",
	US: "passport-api-us.hoyoverse.com",
	SEA: "passport-api-sg.hoyoverse.com"
};
const DEFAULT_PASSPORT_HOST = PASSPORT_HOSTS.EU;

/** What stops working when each class dies. Goes straight into the alert text. */
const CLASS_IMPACT = {
	ltoken: "daily check-in, Mimo, stamina and reminders",
	cookieToken: "code redemption"
};

const passportHost = (cookieMap) => {
	const region = String(cookieMap.ma_passport_region ?? "").toUpperCase();
	return PASSPORT_HOSTS[region] ?? DEFAULT_PASSPORT_HOST;
};

const buildPairs = (cookieMap, fields) => fields
	.map(field => `${field}=${cookieMap[field]}`)
	.join("; ");

/**
 * Classifies one probe response.
 *
 * Judged on the success condition rather than on a list of known error codes,
 * because the vendor adds codes whenever it likes and an unrecognised one must
 * read as unhealthy. `inconclusive` means the instrument failed (timeout, DNS,
 * non-JSON) and says nothing about the credential.
 */
const classify = ({ ok, statusCode, body }) => {
	if (!ok) {
		return { state: "inconclusive", detail: "probe request failed" };
	}

	if (statusCode !== 200 || typeof body !== "object" || body === null) {
		return { state: "inconclusive", detail: `unexpected HTTP ${statusCode}` };
	}

	if (body.retcode === 0) {
		return { state: "healthy" };
	}

	if (typeof body.retcode !== "number") {
		return { state: "inconclusive", detail: "response had no retcode" };
	}

	return {
		state: "dead",
		detail: `retcode ${body.retcode}: ${body.message ?? "no message"}`
	};
};

const probe = async (cookieMap, { path, fields }) => {
	const url = `https://${passportHost(cookieMap)}/account/ma-passport/token/${path}`;

	let res;
	try {
		res = await app.Got("API", {
			url,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			headers: {
				Cookie: buildPairs(cookieMap, fields),
				"content-type": "application/json"
			},
			body: "{}"
		});
	}
	catch (e) {
		return { state: "inconclusive", detail: `probe request threw: ${e.message}` };
	}

	return classify({ ok: true, statusCode: res.statusCode, body: res.body });
};

const checkLtoken = (cookieMap) => probe(cookieMap, {
	path: "verifyLToken",
	fields: LTOKEN_FIELDS
});

const checkCookieToken = (cookieMap) => probe(cookieMap, {
	path: "verifyCookieToken",
	fields: COOKIE_TOKEN_FIELDS
});

/**
 * Probes both classes for one account and returns a flat list of findings.
 * An account whose cookie carries no redemption fields is not probed for them:
 * that state is itself the finding, and it is reported by the caller.
 */
const checkAccount = async (account) => {
	const cookieMap = Cookie.parseCookieMap(account.cookie);
	const findings = [];

	const ltoken = await checkLtoken(cookieMap);
	findings.push({ credential: "ltoken_v2", impact: CLASS_IMPACT.ltoken, ...ltoken });

	const missingRedeem = Cookie.missingKeys(cookieMap, COOKIE_TOKEN_FIELDS);
	if (missingRedeem.length === 0) {
		const cookieToken = await checkCookieToken(cookieMap);
		findings.push({ credential: "cookie_token_v2", impact: CLASS_IMPACT.cookieToken, ...cookieToken });
	}
	else {
		// Nothing to probe, and that is the finding. A cookie that arrives without
		// these fields makes the app switch redemption off by itself and say
		// nothing, which is the exact state that went unnoticed for twelve days.
		findings.push({
			credential: "cookie_token_v2",
			impact: CLASS_IMPACT.cookieToken,
			state: "dead",
			detail: `cookie is missing ${missingRedeem.join(", ")}, so redemption disabled itself`
		});
	}

	return findings;
};

module.exports = {
	LTOKEN_FIELDS,
	COOKIE_TOKEN_FIELDS,
	PASSPORT_HOSTS,
	DEFAULT_PASSPORT_HOST,
	CLASS_IMPACT,
	passportHost,
	buildPairs,
	classify,
	checkLtoken,
	checkCookieToken,
	checkAccount
};
