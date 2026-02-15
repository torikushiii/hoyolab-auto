module.exports = class Telegram extends require("./template.js") {
	lastUpdatedId = 0;
	firstRun = true;
	disableNotification = false;
	messageListeners = [];

	handlingCallbackQuery = false;

	static possibleCommands = [
		"/stamina",
		"/expedition",
		"/notes",
		"/redeem"
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
		const res = await app.Got("API", {
			url: `https://api.telegram.org/bot${this.token}/getUpdates`,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			json: {
				offset: this.lastUpdatedId + 1,
				allowed_updates: ["message", "callback_query"]
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

		if (this.firstRun) {
			this.firstRun = false;
			return;
		}

		const { result } = res.body;

		if (result.length > 0) {
			await this.processMessageUpdates(result);
			this.lastUpdatedId = result[result.length - 1].update_id;
		}
	}

	async send (message, options = {}) {
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

		const res = await app.Got("API", {
			url: `https://api.telegram.org/bot${this.token}/sendMessage`,
			method: "POST",
			responseType: "json",
			throwHttpErrors: false,
			json: {
				chat_id: this.chatId,
				text: message,
				parse_mode: "MarkdownV2",
				disable_notification: this.disableNotification,
				...options
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

	async handleCommand (data) {
		const { command, args, channelData, userData } = data;

		if (command === "redeem") {
			// eslint-disable-next-line object-curly-spacing
			const accounts = app.HoyoLab.getActiveAccounts({ blacklist: ["honkai", "tot"] });
			if (accounts.length === 0) {
				await this.send("There are no accounts available for redeeming codes.");
				return;
			}

			const keyboard = [];
			for (const account of accounts) {
				const game = account.game.short.toLowerCase();
				const region = app.HoyoLab.getRegion(account.region);

				const text = `(${region}) ${account.game.short} - (${account.uid}) ${account.nickname}`;
				keyboard.push([
					{
						text,
						callback_data: `redeem:${game}:${account.uid}`
					}
				]);
			}

			await this.send(
				"Please select the account you want to redeem the code for:",
				{
					reply_markup: {
						inline_keyboard: keyboard
					}
				}
			);
			return;
		}

		const execution = await app.Command.checkAndRun(
			command,
			args,
			channelData,
			userData,
			{
				platform: {
					id: 2,
					name: "Telegram"
				}
			}
		);

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
		if (messageData.callback_query) {
			this.handlingCallbackQuery = true;

			try {
				const data = messageData.callback_query.data;
				if (typeof data === "string" && data.startsWith("redeem:")) {
					const parts = data.split(":");

					let game = parts[1];
					const uid = parts[2];

					await this.send("Please enter the code you want to redeem:");

					const code = await this.waitForUserInput(
						messageData.callback_query.from.id,
						messageData.callback_query
					);

					if (code) {
						if (game === "zzz") {
							game = "nap";
						}
						else if (game === "hsr") {
							game = "starrail";
						}
						else if (game === "gi") {
							game = "genshin";
						}

						const res = await app.HoyoLab.redeemCode(game, uid, code);
						if (!res.success) {
							const reason = this.prepareMessage(res.data.reason);
							await this.send(`Failed to redeem code: ${reason}`);
						}
						else {
							await this.send(`Successfully redeemed code: ${code}`);
						}
					}
					return;
				}
			}
			finally {
				this.handlingCallbackQuery = false;
			}
		}

		const message = this.prepareMessage(messageData, options);
		if (message) {
			return message;
		}
	}

	prepareMessage (messageData) {
		const escapedMessage = app.Utils.escapeCharacters(messageData);

		return escapedMessage;
	}

	addMessageListener (listener) {
		this.messageListeners.push(listener);
	}

	removeMessageListener (listener) {
		this.messageListeners = this.messageListeners.filter((l) => l !== listener);
	}

	async waitForUserInput (userId, callbackQuery) {
		return new Promise((resolve, reject) => {
			const listener = async (msgData) => {
				if (msgData.message && msgData.message.from.id === userId) {
					const code = msgData.message.text;
					this.removeMessageListener(listener);
					resolve(code);
				}
			};
			this.addMessageListener(listener);
		});
	}

	async processMessageUpdates (result) {
		for (const update of result) {
			if (update.callback_query && !this.handlingCallbackQuery) {
				await this.handleMessage(update);
			}
			else if (update.message) {
				const { message } = update;
				let handled = false;

				if (typeof message.text === "string") {
					const command = message.text.split(" ")[0];
					if (Telegram.possibleCommands.includes(command)) {
						const args = message.text.split(" ").slice(1);
						const channelData = {
							id: message.chat.id,
							name: message.chat.title ?? null
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
						handled = true;
					}
				}

				if (!handled) {
					for (const listener of this.messageListeners) {
						await listener(update);
					}
				}
			}
		}
	}
};
