const formatText = (value) => String(value).replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (match, timestamp) => {
	const date = new Date(Number(timestamp) * 1000);
	return Number.isNaN(date.getTime()) ? match : date.toISOString();
});

module.exports = class Gotify extends require("./template.js") {
	#messageURL;
	#priority;

	constructor (config) {
		super("gotify", config);

		let serverURL;
		try {
			if (typeof this.url !== "string") {
				throw new Error("Missing URL");
			}
			serverURL = new URL(this.url);
		}
		catch {
			throw new app.Error({ message: "Invalid Gotify server URL. Provide an HTTP or HTTPS URL." });
		}

		if (!["http:", "https:"].includes(serverURL.protocol) || serverURL.username || serverURL.password || serverURL.search || serverURL.hash) {
			throw new app.Error({ message: "Invalid Gotify server URL. Use an HTTP or HTTPS URL without credentials, query parameters, or a fragment." });
		}
		if (typeof this.token !== "string" || this.token.trim().length === 0) {
			throw new app.Error({ message: "No Gotify application token provided." });
		}

		this.#priority = config.priority ?? 5;
		if (!Number.isSafeInteger(this.#priority)) {
			throw new app.Error({ message: "Gotify priority must be an integer." });
		}

		serverURL.pathname = `${serverURL.pathname.replace(/\/+$/, "")}/message`;
		this.#messageURL = serverURL.toString();
	}

	connect () {}

	prepareMessage (messageData, options = {}) {
		let title = options.title ?? "HoyoLab Auto";
		let message;

		if (typeof messageData === "string") {
			message = formatText(messageData);
		}
		else if (messageData && typeof messageData === "object" && !Array.isArray(messageData)) {
			title = options.title ?? messageData.title ?? title;
			const lines = [];
			if (messageData.author?.name) {
				lines.push(formatText(messageData.author.name));
			}
			if (messageData.description) {
				lines.push(formatText(messageData.description));
			}
			for (const field of messageData.fields ?? []) {
				lines.push(`**${formatText(field.name)}:** ${formatText(field.value)}`);
			}
			message = lines.join("\n\n") || formatText(title);
		}
		else {
			throw new app.Error({ message: "Gotify messages must be strings or notification objects." });
		}

		if (message.trim().length === 0) {
			throw new app.Error({ message: "Gotify messages must not be empty." });
		}
		const priority = options.priority ?? this.#priority;
		if (!Number.isSafeInteger(priority)) {
			throw new app.Error({ message: "Gotify priority must be an integer." });
		}

		return {
			title: formatText(title),
			message,
			priority,
			extras: {
				"client::display": { contentType: "text/markdown" }
			}
		};
	}

	async send (messageData, options = {}) {
		const message = this.prepareMessage(messageData, options);
		let response;
		try {
			response = await app.Got("API", {
				url: this.#messageURL,
				method: "POST",
				responseType: "json",
				throwHttpErrors: false,
				followRedirect: false,
				headers: { "X-Gotify-Key": this.token.trim() },
				json: message
			});
		}
		catch (e) {
			throw new app.Error({
				message: "Failed to send Gotify notification",
				args: { code: e.code ?? null }
			});
		}

		if (response.statusCode < 200 || response.statusCode >= 300) {
			throw new app.Error({
				message: "Failed to send Gotify notification",
				args: {
					statusCode: response.statusCode,
					statusMessage: response.statusMessage
				}
			});
		}
		return true;
	}

	createUserMention () {
		return null;
	}
};
