const config = {
	data: [
		// "honkai_impact_cookie_1",
		// "honkai_impact_cookie_2",
		// Add more cookies as needed...
	]
};

const DISCORD_WEBHOOK = null; // Replace with your Discord webhook URL (optional)
const DEFAULT_CONSTANTS = {
	ACT_ID: "e202110291205111",
	successMessage: "You have successfully checked in today, Captain~",
	signedMessage: "You've already checked in today, Captain~",
	assets: {
		author: "Kiana",
		game: "Honkai Impact 3rd"
	},
	url: {
		info: "https://sg-public-api.hoyolab.com/event/mani/info",
		home: "https://sg-public-api.hoyolab.com/event/mani/home",
		sign: "https://sg-public-api.hoyolab.com/event/mani/sign"
	}
};

/**
 * Class representing the Honkai Impact 3rd game for daily check-in.
 */
class HonkaiImpact {
	/**
   * Create a HonkaiImpact object.
   * @param {Object} config - The configuration object for the check-in.
   * @param {string} config.id - The HoyoLab ID.
   * @param {Account[]} config.data - Array of Honkai Impact account objects.
   * @param {Object} [config.config=DEFAULT_CONSTANTS] - Custom constants.
   */
	constructor (config) {
		this.name = "honkai";
		this.fullName = "Honkai Impact 3rd";
		this.id = config.id;
		this.data = config.data || [];
		this.config = { ...DEFAULT_CONSTANTS, ...config.config };

		if (this.data.length === 0) {
			throw new Error("No Honkai Impact accounts provided");
		}
	}

	/**
   * Performs daily check-in for Honkai Impact accounts.
   * @returns {Promise<SuccessObject[]>} Array of successful check-in objects.
   */
	async checkAndExecute () {
		const accounts = this.data;
		if (accounts.length === 0) {
			console.warn("No active accounts found for Honkai Impact 3rd");
			return [];
		}

		const success = [];
		for (const cookie of accounts) {
			try {
				const info = await this.getSignInfo(cookie);
				if (!info.success) {continue;}

				const awardsData = await this.getAwardsData(cookie);
				if (!awardsData.success) {continue;}

				const awards = awardsData.data;
				const data = {
					total: info.data.total,
					today: info.data.today,
					isSigned: info.data.isSigned
				};

				if (data.isSigned) {
					console.info(`${this.fullName}:CheckIn`, `Already signed in today`);
					continue;
				}

				const totalSigned = data.total;
				const awardObject = {
					name: awards[totalSigned].name,
					count: awards[totalSigned].cnt,
					icon: awards[totalSigned].icon
				};

				const sign = await this.sign(cookie);
				if (!sign.success) {continue;}

				console.info(
					`${this.fullName}:CheckIn`,
					`Today's Reward: ${awardObject.name} x${awardObject.count}`
				);

				success.push({
					platform: this.name,
					total: data.total + 1,
					result: this.config.successMessage,
					assets: { ...this.config.assets },
					award: awardObject
				});
			}
			catch (e) {
				console.error(`${this.fullName}:CheckIn`, e);
			}
		}

		return success;
	}

	/**
   * Performs the sign-in request.
   * @param {string} cookieData - The MiHoYo account cookie.
   * @returns {Promise<{ success: boolean }>} - Sign-in success status.
   */
	async sign (cookieData) {
		try {
			const payload = { act_id: this.config.ACT_ID };
			const options = {
				method: "POST",
				contentType: "application/json",
				headers: {
					"User-Agent": this.userAgent,
					Cookie: cookieData
				},
				payload: JSON.stringify(payload)
			};

			const response = UrlFetchApp.fetch(this.config.url.sign, options);
			const data = JSON.parse(response.getContentText());

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(`${this.fullName}:sign`, `Failed to sign in.`, data);
				return { success: false };
			}

			return { success: true };
		}
		catch (e) {
			console.error(`${this.fullName}:sign`, `Error: ${e.message}`);
			return { success: false };
		}
	}

	/**
   * Retrieves sign-in information.
   * @param {string} cookieData - MiHoYo account cookie.
   * @returns {Promise<{ success: boolean, data: SignInfo }>} Sign-in info.
   */
	async getSignInfo (cookieData) {
		try {
			const url = `${this.config.url.info}?act_id=${this.config.ACT_ID}`;
			const response = await UrlFetchApp.fetch(url, {
				headers: { Cookie: cookieData }
			});
			const data = JSON.parse(response.getContentText());

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(`${this.fullName}:getSignInfo`, "Failed to get sign info.", data);
				return { success: false };
			}

			return {
				success: true,
				data: {
					total: data.data.total_sign_day,
					today: data.data.today,
					isSigned: data.data.is_sign
				}
			};
		}
		catch (e) {
			console.error(
				`${this.fullName}:getSignInfo`,
				`Error: ${e.message}`
			);
			return { success: false };
		}
	}

	/**
   * Retrieves the awards data.
   * @param {string} cookieData - The MiHoYo account cookie.
   * @returns {Promise<{ success: boolean, data: any[] }>} - Awards data.
   */
	async getAwardsData (cookieData) {
		try {
			const url = `${this.config.url.home}?act_id=${this.config.ACT_ID}`;
			const response = await UrlFetchApp.fetch(url, {
				headers: { Cookie: cookieData }
			});
			const data = JSON.parse(response.getContentText());

			if (response.getResponseCode() !== 200 || data.retcode !== 0) {
				console.error(`${this.fullName}:getAwardsData`, "Failed to get awards data.", data);
				return { success: false };
			}

			if (data.data.awards.length === 0) {
				console.warn(`${this.fullName}:getAwardsData`, "No awards data available.");
			}

			return { success: true, data: data.data.awards };
		}
		catch (e) {
			console.error(
				`${this.fullName}:getAwardsData`,
				`Error: ${e.message}`
			);
			return { success: false };
		}
	}

	get userAgent () {
		return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36";
	}
}

/**
 * Function to perform Honkai Impact 3rd check-in.
 */
function checkInHonkaiImpact () {
	const honkaiImpact = new HonkaiImpact(config);

	honkaiImpact
		.checkAndExecute()
		.then((successes) => {
			console.log("Successful check-ins:", successes);

			if (DISCORD_WEBHOOK) {
				for (const success of successes) {
					const embed = {
						color: 16748258,
						title: "Honkai Impact 3rd Daily Check-In",
						author: {
							name: "Kiana",
							icon_url: "https://fastcdn.hoyoverse.com/static-resource-v2/2024/02/29/3d96534fd7a35a725f7884e6137346d1_3942255444511793944.png"
						},
						description: `Today's Reward: ${success.award.name} x${success.award.count}`
                        + `\nTotal Check-Ins: ${success.total}`,
						thumbnail: {
							url: success.award.icon
						},
						timestamp: new Date(),
						footer: {
							text: "Honkai: Star Rail Daily Check-In"
						}
					};

					UrlFetchApp.fetch(DISCORD_WEBHOOK, {
						method: "POST",
						contentType: "application/json",
						payload: JSON.stringify({
							embeds: [embed],
							username: "Kiana",
							avatar_url: "https://fastcdn.hoyoverse.com/static-resource-v2/2024/02/29/3d96534fd7a35a725f7884e6137346d1_3942255444511793944.png"
						})
					});
				}
			}
		})
		.catch((e) => {
			console.error("An error occurred during check-in:", e);
		});
}
