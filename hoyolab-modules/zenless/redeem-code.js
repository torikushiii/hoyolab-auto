module.exports = class RedeemCode {
	/** @type {import("../template")} */
	#instance;

	constructor (instance) {
		this.#instance = instance;
	}

	async redeemCode (accountData, code) {
		const cookieData = app.HoyoLab.parseCookie(accountData.cookie, {
			whitelist: [
				"cookie_token_v2",
				"account_mid_v2",
				"account_id_v2",
				"cookie_token",
				"account_id"
			]
		});

		const res = await app.Got("MiHoYo", {
			url: this.#instance.config.url.redemption,
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				t: Date.now(),
				lang: "en",
				game_biz: "nap_global",
				uid: accountData.uid,
				region: accountData.region,
				cdkey: code
			},
			headers: {
				Cookie: cookieData
			}
		});

		if (res.statusCode !== 200) {
			app.Logger.log(`${this.#instance.fullName}:RedeemCode`, {
				message: "Request threw non-200 status code",
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
				message: "Failed to redeem code",
				args: {
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

		app.Logger.info(`${this.#instance.fullName}:RedeemCode`, `(${accountData.uid}) ${accountData.nickname} redeemed code: ${code}`);

		return {
			success: true
		};
	}
};
