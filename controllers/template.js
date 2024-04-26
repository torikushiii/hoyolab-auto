/* eslint-disable no-unused-vars */
module.exports = class Controller {
	initListeners () {}
	
	async send (message, options = {}) {}

	prepareMessage (messageData, options = {}) {
		if (!options.type) {
			throw new app.Error({
				message: "No type provided for webhook message preparation",
				args: {
					type: options.type
				}
			});
		}

		if (typeof messageData !== "object" && typeof messageData !== "string") {
			throw new app.Error({
				message: "Invalid message data provided.",
				args: {
					messageData
				}
			});
		}

		const types = [
			"stamina",
			"check-in",
			"expedition",
			"dailies",
			"weeklies"
		];

		const type = options.type;
		if (!types.includes(type)) {
			throw new app.Error({
				message: "Invalid type provided.",
				args: {
					type
				}
			});
		}

		return messageData;
	}

	static buildFields (data) {
		const fields = [
			{
				name: "Nickname",
				value: data.username,
				inline: true
			},
			{
				name: "UID",
				value: data.uid,
				inline: true
			},
			{
				name: "Rank",
				value: data.rank,
				inline: true
			},
			{
				name: "Region",
				value: app.Utils.formattedAccountRegion(data.region),
				inline: true
			},
			{
				name: "Today's Reward",
				value: `${data.award.name} x${data.award.count}`,
				inline: true
			},
			{
				name: "Total Sign-Ins",
				value: data.total,
				inline: true
			},
			{
				name: "Result",
				value: data.result,
				inline: true
			}
		];

		return fields;
	}

	destroy () {}
};
