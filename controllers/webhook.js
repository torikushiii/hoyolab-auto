module.exports = class Webhook extends require("./template.js") {
	#token;
	#active = false;

	static webhookRegex = /https:\/\/discord.com\/api\/webhooks\/\d+\/[\w-]+/;

	constructor () {
		super();

		const config = app.Config.get("webhook");
		if (config.enabled !== true) {
			app.Logger.warn("Webhook", "Webhook is disabled, skipping webhook notifications");
			return;
		}
		else if (config.token === null) {
			app.Logger.warn("Webhook", "Webhook token is not set, skipping webhook notifications");
			return;
		}

		const token = config.token;
		if (!Webhook.webhookRegex.test(token)) {
			throw new app.Error({
				message: "Invalid webhook token provided",
				args: { token }
			});
		}

		this.#active = true;
		this.#token = token;

		app.Logger.info("Webhook", "Webhook initialized");
	}

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
			url: this.#token,
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

	get active () { return this.#active; }
};
