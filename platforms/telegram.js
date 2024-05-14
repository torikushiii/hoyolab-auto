module.exports = class Telegram extends require("./template.js") {
	lastUpdatedId = 0;
	
	gotModule;
	gotRequestErrors;

	static possibleCommands = [
		"/stamina",
		"/expedition"
	];

	constructor (config) {
		super("telegram", config);

		if (!this.chatId) {
			throw new app.Error({
				message: "No chat ID provided for Telegram controller"
			});
		}
		else if (!this.token) {
			throw new app.Error({
				message: "Telegram token has not been configured for the bot"
			});
		}

		// If you received error message such as "409: Conflict", try to increase the interval
		setInterval(() => this.connect(), 5000);
	}

	async connect () {
		const res = await app.Got({
			url: `https://api.telegram.org/bot${this.token}/getUpdates`,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			json: {
				offset: this.lastUpdatedId + 1
			}
		});

		if (res.body.ok !== true) {
			throw new app.Error({
				message: "Failed to get telegram updates",
				args: {
					statusCode: res.statusCode,
					statusMessage: res.statusMessage,
					body: res.body
				}
			});
		}

		const { result } = res.body;
		if (result.length === 0) {
			this.firstRun = false;
			return;
		}

		if (this.firstRun === true && result.length > 0) {
			this.lastUpdatedId = result[result.length - 1].update_id;
			this.firstRun = false;
			return;
		}

		for (const update of result) {
			const { message } = update;
			if (!message) {
				continue;
			}

			const { chat, text } = message;
			if (chat.id !== this.chatId) {
				continue;
			}

			this.lastUpdatedId = update.update_id;

			const command = text.split(" ")[0];
			if (!Telegram.possibleCommands.includes(command)) {
				continue;
			}

			const args = text.split(" ").slice(1);
			const channelData = {
				id: chat.id,
				name: chat.title ?? null
			};
			const userData = {
				id: message.from.id,
				username: message.from.first_name ?? null
			};

			await this.handleCommand({
				command: command.slice(1),
				args,
				channelData,
				userData
			});
		}
	}

	async send (message) {
		if (typeof message !== "string") {
			throw new app.Error({
				message: "Provided message is not a string",
				args: {
					message: {
						type: typeof message,
						constructor: message?.constructor?.name ?? "N/A"
					}
				}
			});
		}

		try {
			const res = await app.Got({
				url: `https://api.telegram.org/bot${this.token}/sendMessage`,
				method: "POST",
				responseType: "json",
				throwHttpErrors: false,
				json: {
					chat_id: this.chatId,
					text: message,
					parse_mode: "MarkdownV2",
					disable_notification: this.disableNotification
				}
			});
	
			if (res.body.ok !== true) {
				throw new app.Error({
					message: "Failed to send telegram message",
					args: {
						statusCode: res.statusCode,
						statusMessage: res.statusMessage,
						body: res.body
					}
				});
			}
	
			return true;
		}
		catch (e) {
			const isGotRequestError = await this.isGotRequestError(e);
			if (isGotRequestError) {
				return app.Logger.error("Telegram", {
					message: "Failed to send telegram message",
					args: { error: e }
				});
			}

			throw e;
		}
	}

	async handleCommand (data) {
		const {
			command,
			args,
			channelData,
			userData
		} = data;

		const execution = await app.Command.checkAndRun(command, args, channelData, userData, {
			platform: {
				id: 2,
				name: "Telegram"
			}
		});

		if (!execution) {
			return;
		}

		const { reply } = execution;

		const message = this.prepareMessage(reply);
		if (message) {
			await this.send(message);
		}
	}

	async handleMessage (messageData, options = {}) {
		const message = this.prepareMessage(messageData, options);
		if (message) {
			return message;
		}
	}

	prepareMessage (messageData) {
		const escapedMessage = app.Utils.escapeCharacters(messageData);

		return escapedMessage;
	}

	async isGotRequestError (error) {
		this.gotModule ??= await import("got");
		this.gotRequestErrors ??= [
			this.gotModule.CancelError,
			this.gotModule.HTTPError,
			this.gotModule.RequestError,
			this.gotModule.TimeoutError
		];

		return this.gotRequestErrors.some(err => error instanceof err);
	}
};
