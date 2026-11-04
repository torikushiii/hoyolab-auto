const { t } = require("../../localization/index.js");
const checkInDescriptor = require("./check-in-descriptor.js");
const CheckIn = require("./check-in.js");
const { getRole, redeemCode } = require("./redemption-request.js");

const DEFAULT_CONSTANTS = {
	ACT_ID: checkInDescriptor.actId,
	successMessage: t("Successfully signed in"),
	signedMessage: t("Already signed in today"),
	assets: {
		author: "Luke",
		game: "Tears of Themis"
	},
	url: {
		...checkInDescriptor.urls
	}
};

module.exports = class TearsOfThemis extends require("../template.js") {
	#logo;
	#color;

	constructor (config) {
		super("tot", config, {
			gameId: 0,
			config: DEFAULT_CONSTANTS
		});

		if (!this.id) {
			throw new app.Error({
				message: t("No HoyoLab ID provided for TearsOfThemis controller")
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: t("No TearsOfThemis accounts provided")
			});
		}
	}

	async login () {
		const accounts = this.data;

		let accountList = 0;
		for (const account of accounts) {
			const cookieData = account.cookie;
			const ltuid = account.ltuid;
			let discovery;
			// Check-in only needs ltoken; missing redemption credentials must not break it.
			if (/cookie_token_v2=/.test(cookieData)) {
				try {
					discovery = await getRole(account);
				}
				catch {
					// Transport diagnostics belong to Got; never log the cookie or raw response.
				}
			}
			const role = discovery?.success ? discovery.role : null;
			if (!role) {
				app.Logger.warn(this.fullName, t("Could not load the Tears of Themis character. Check-in remains available; restart the bot after restoring the linked account and redemption cookie."));
			}

			this.#logo = "https://hyl-static-res-prod.hoyolab.com/communityweb/business/nxx_hoyoverse.png";
			this.#color = 0xFF8300;

			this.accounts.push({
				platform: this.name,
				uid: role ? String(role.game_uid) : ltuid,
				ltuid,
				nickname: role?.nickname ?? "",
				region: role?.region ?? "Global",
				timezone: "GLOBAL",
				level: role?.level ?? "",
				redemptionRoleAvailable: Boolean(role),
				// Keep existing pending/completed/login cache keys across the UI identity change.
				redemptionQueueAccount: { uid: ltuid, region: "Global" },
				cookie: cookieData,
				redeemCode: account.redeemCode,
				redeemCodeConfigured: account.redeemCodeConfigured,
				game: {
					name: "Tears of Themis",
					short: "ToT"
				},
				assets: {
					...this.config.assets,
					...this.config.url,
					logo: this.#logo,
					color: this.#color
				},
				allowedPlatforms: account.allowedPlatforms ?? null
			});

			accountList++;
			app.Logger.info(this.fullName, t `Logged into account ${accountList} [${role?.game_uid ?? ltuid}] (Tears of Themis)`);
		}
	}

	get logo () { return this.#logo; }
	get color () { return this.#color; }

	async redeemCode (accountData, code) {
		const result = await redeemCode(accountData, code);
		return result.success ? { success: true } : { success: false, message: result.reason };
	}

	async checkIn (accountData) {
		const ci = new CheckIn(this, {
			logo: this.#logo,
			color: this.#color
		});

		return await ci.checkAndExecute(accountData);
	}
};
