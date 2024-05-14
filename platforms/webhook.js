module.exports = class Webhook extends require("./template.js") {
	constructor (config) {
		super("webhook", config);

		if (!this.url) {
			throw new app.Error({
				message: "No webhook URL provided"
			});
		}
	}

	connect () {}
	
	async send (message) {
		if (!this.active) {
			throw new app.Error({
				message: "Webhook is not active"
			});
		}
		else if (typeof message !== "object") {
			throw new app.Error({
				message: "Provided message is not an object",
				args: {
					message: {
						type: typeof message,
						constructor: message?.constructor?.name ?? "N/A"
					}
				}
			});
		}

		const res = await app.Got({
			url: this.token,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				wait: true
			},
			json: {
				embeds: [message],
				username: message.author?.name ?? "HoyoLab",
				avatar_url: message.author.icon_url
			}
		});

		if (res.statusCode !== 200) {
			throw new app.Error({
				message: "Failed to send webhook message",
				args: {
					statusCode: res.statusCode,
					statusMessage: res.statusMessage
				}
			});
		}

		return true;
	}

	async handleMessage (messageData, options = {}) {
		if (!this.active) {
			return;
		}

		const messages = this.prepareMessage(messageData, options);
		if (messages) {
			return messages;
		}
	}
};
