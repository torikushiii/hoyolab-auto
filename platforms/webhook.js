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

	async send (message, options = {}) {
		if (typeof message !== "object") {
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

		const res = await app.Got("API", {
			url: this.url,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			searchParams: {
				wait: true
			},
			json: {
				embeds: [message],
				username: options.author ?? "HoyoLab",
				avatar_url: options.icon ?? "https://i.ibb.co/nRqTkXv/image.png"
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
