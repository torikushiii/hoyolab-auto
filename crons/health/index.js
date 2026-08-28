const CredentialProbe = require("../../object/credential-probe.js");

const HEARTBEAT_TIMEOUT_MS = 15000;

/**
 * Sends the heartbeat. Only ever called with a decided verdict: a failed probe
 * sends nothing at all, so a transient network fault reads as one missed beat
 * rather than as a dead credential.
 */
const pushHeartbeat = async (url, { up, message }) => {
	const target = new URL(url);
	target.searchParams.set("status", up ? "up" : "down");
	target.searchParams.set("msg", message);

	try {
		const res = await app.Got("API", {
			url: target.toString(),
			method: "GET",
			responseType: "text",
			throwHttpErrors: false,
			timeout: { request: HEARTBEAT_TIMEOUT_MS }
		});

		if (res.statusCode !== 200) {
			app.Logger.error("Cron:Health", `Heartbeat rejected with HTTP ${res.statusCode}. The watchdog is blind, check the push URL.`);
			return;
		}

		app.Logger.debug("Cron:Health", `Heartbeat sent (${up ? "up" : "down"})`);
	}
	catch (e) {
		// A dead heartbeat is a monitoring fault, not a failed run. Uptime Kuma
		// notices the silence on its own, so log it and let the run stand.
		app.Logger.error("Cron:Health", `Heartbeat failed: ${e.message}. The watchdog is blind, check the push URL.`);
	}
};

const describe = (account) => `${account.game?.short ?? account.platform} ${account.uid ?? "?"}`;

module.exports = {
	name: "health",
	expression: "*/30 * * * *",
	description: "Verify each credential class still works and report to the watchdog",
	code: (async function health () {
		const config = app.Config.get("health") ?? {};
		const accounts = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai", "tot"] });
		if (accounts.length === 0) {
			return;
		}

		const dead = [];
		const inconclusive = [];

		for (const account of accounts) {
			let findings;
			try {
				findings = await CredentialProbe.checkAccount(account);
			}
			catch (e) {
				inconclusive.push(`${describe(account)}: ${e.message}`);
				continue;
			}

			for (const finding of findings) {
				if (finding.state === "dead") {
					dead.push(`${describe(account)} ${finding.credential} is dead, so ${finding.impact} stop working (${finding.detail})`);
				}
				else if (finding.state === "inconclusive") {
					inconclusive.push(`${describe(account)} ${finding.credential}: ${finding.detail}`);
				}
			}
		}

		for (const line of dead) {
			app.Logger.error("Cron:Health", line);
		}
		for (const line of inconclusive) {
			app.Logger.warn("Cron:Health", line);
		}

		const pushUrl = config.kumaPushUrl;
		if (!pushUrl || pushUrl.startsWith("$")) {
			// Unconfigured is a legitimate state for a local run or a fresh clone.
			// Say so once per run rather than failing.
			app.Logger.debug("Cron:Health", "No health.kumaPushUrl configured, so results are logged only");
			return;
		}

		if (dead.length !== 0) {
			await pushHeartbeat(pushUrl, { up: false, message: dead.join(" | ") });
			return;
		}

		if (inconclusive.length !== 0) {
			// Undecided. Send nothing and let the missed beat speak for itself.
			app.Logger.warn("Cron:Health", "Credential state undetermined, skipping the heartbeat");
			return;
		}

		await pushHeartbeat(pushUrl, {
			up: true,
			message: `${accounts.length} account(s) OK`
		});
	})
};
