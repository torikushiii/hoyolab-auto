const WEBHOOK_REGEX = /https:\/\/discord.com\/api\/webhooks\/\d+\/[\w-]+/;

module.exports = class Platform {
	#id;
	#url;
	#name;
	#botId;
	#token;
	#prefix;
	#chatId;
	#data;
	#disableNotification;

	client;

	/** @type {Platform[]} */
	static list = [];

	constructor (name, config) {
		this.#name = name;
		this.#id = config.id;
		if (!this.#id) {
			throw new app.Error({
				message: "No ID provided for Platform."
			});
		}
		else if (typeof this.#id !== "number") {
			throw new app.Error({
				message: "Invalid ID must be a number."
			});
		}

		this.#url = config.url ?? null;
		if (this.#url && !WEBHOOK_REGEX.test(this.#url)) {
			throw new app.Error({
				message: "Invalid URL provided for Webhook Platform.",
				args: {
					url: this.#url
				}
			});
		}

		this.#botId = config.botId ?? null;
		this.#token = config.token ?? null;
		this.#prefix = config.prefix ?? null;
		this.#chatId = config.chatId ?? null;
		this.#disableNotification = config.disableNotification ?? false;

		this.#data = config.platform ?? {};

		Platform.list.push(this);
	}

	get ID () { return this.#id; }
	get id () { return this.#id; }
	get Name () { return this.#name; }
	get name () { return this.#name; }
	get URL () { return this.#url; }
	get url () { return this.#url; }
	get botId () { return this.#botId; }
	get Token () { return this.#token; }
	get token () { return this.#token; }
	get Prefix () { return this.#prefix; }
	get prefix () { return this.#prefix; }
	get chatId () { return this.#chatId; }
	get Data () { return this.#data; }
	get data () { return this.#data; }
	get disableNotification () { return this.#disableNotification; }

	initListeners () {}

	// eslint-disable-next-line no-unused-vars
	async send (message, options = {}) {
		throw new app.Error({
			message: "Send method not implemented by the Platform."
		});
	}

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

	restart () {}

	destroy () {}

	static get (identifier) {
		if (identifier instanceof Platform) {
			return identifier;
		}
		else if (typeof identifier === "number") {
			return Platform.list.find(i => i.id === identifier) ?? null;
		}
		else if (typeof identifier === "string") {
			const platform = Platform.list.find(i => i.name === identifier);
			if (platform.length === 0) {
				return null;
			}

			return platform;
		}
		else {
			throw new app.Error({
				message: "Unrecognized identifier type.",
				args: typeof identifier
			});
		}
	}

	static create (type, config) {
		let InstancePlatform;
		switch (type) {
			case "webhook":
				InstancePlatform = require("./webhook.js");
				break;
			case "discord":
				InstancePlatform = require("./discord.js");
				break;
			case "telegram":
				InstancePlatform = require("./telegram.js");
				break;
			default:
				throw new app.Error({
					message: "Invalid platform type provided.",
					args: {
						type,
						config
					}
				});
		}

		return new InstancePlatform(config);
	}
};
