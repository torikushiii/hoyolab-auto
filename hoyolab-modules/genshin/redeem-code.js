const { t } = require("../../localization/index.js");
const { requestRedemption } = require("./redemption-request.js");

module.exports = class RedeemCode {
	/** @type {import("../template")} */
	#instance;

	constructor (instance) {
		this.#instance = instance;
	}

	async redeemCode (accountData, code) {
		const res = await requestRedemption(accountData, code, this.#instance.config.url.redemption, { persist: true });

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.#instance.fullName}:RedeemCode`, {
				message: t("Request threw non-200 status code"),
				args: {
					code,
					status: res.statusCode,
					body: res.body
				}
			});

			return {
				success: false
			};
		}
		if (res.body.retcode !== 0) {
			app.Logger.log(`${this.#instance.fullName}:RedeemCode`, {
				message: t("Failed to redeem code"),
				args: {
					cause: app.HoyoLab.errorMessage(this.#instance.name, res.body.retcode),
					code,
					status: res.body.retcode,
					body: res.body
				}
			});

			return {
				success: false,
				message: res.body.message
			};
		}

		app.Logger.info(`${this.#instance.fullName}:RedeemCode`, t `(${accountData.uid}) ${accountData.nickname} redeemed code: ${code}`);

		return {
			success: true,
			message: t("Code redeemed successfully!")
		};
	}
};
