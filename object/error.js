const { t } = require("../localization/index.js");

class Error extends globalThis.Error {
	#args;
	#timestamp;
	#messageDescriptor;

	constructor (obj = {}) {
		if (obj.constructor !== Object) {
			throw new globalThis.Error(t("obj must be an object to receive as params"));
		}

		if (typeof obj.message !== "string") {
			throw new globalThis.Error(t("message must be a string"));
		}

		const { cause, message } = obj;
		super(message, { cause });

		if (obj.args) {
			this.#args = Object.freeze(obj.args);
		}

		this.name = obj.name ?? "Error";
		this.#timestamp = Date.now();
		this.#messageDescriptor = Object.getOwnPropertyDescriptor(this, "message");

		Object.defineProperty(this, "message", {
			get: () => {
				const message = (this.#messageDescriptor.get === "function")
					? this.#messageDescriptor.get()
					: this.#messageDescriptor.value;

				const parts = [message];
				if (this.#args) {
					parts.push(t `- args: ${JSON.stringify(this.#args)}`);
				}

				if (this.cause) {
					const causeMessage = t `cause: ${this.cause.message ?? t("(no message)")} ${this.cause.stack ?? t("(no stack)")}`;
					const tabbedCauseMessage = causeMessage
						.trim()
						.split("\n")
						.map(i => `\t${i}`)
						.join("\n");

					parts.push(tabbedCauseMessage);
				}

				return parts.join("\n");
			}
		});
	}

	get args () { return this.#args; }
	get timestamp () { return this.#timestamp; }
	get date () { return new Date(this.#timestamp); }

	static get GenericRequest () {
		return GenericRequestError;
	}

	static get HoyoLabRequest () {
		return HoyoLabRequestError;
	}
}

class GenericRequestError extends Error {
	constructor (obj = {}) {
		super({
			message: obj.message,
			name: "GenericRequestError",
			args: {
				...(obj.args ?? {}),
				statusCode: obj.statusCode ?? null,
				statusMessage: obj.statusMessage ?? null,
				hostname: obj.hostname ?? null
			}
		});
	}

	static get name () {
		return "GenericRequestError";
	}
}

class HoyoLabRequestError extends Error {
	constructor (obj = {}) {
		const errorMessages = {
			1009: t("The account does not exist"),
			"-100": t("The provided cookie is either invalid or expired."),
			"-10001": t("The provided cookie is either invalid or expired."),
			"-10101": t("Cannot get data after more than 30 accounts per cookie per day."),
			"-1048": t("API system is busy, please try again later."),
			"-1071": t("The provided cookie is either invalid or expired."),
			"-2001": t("The code has expired"),
			"-2003": t("The code is invalid"),
			"-2016": t("Redemption is in cooldown"),
			"-2017": t("The code has been used")
		};

		const CaptchaCodes = [
			10035,
			5003,
			10041,
			1034
		];

		const isCaptchaCode = CaptchaCodes.includes(obj.retcode);
		const message = (isCaptchaCode)
			? t("A captcha challenge was requested. Please solve it and try again.")
			: errorMessages[obj.retcode] ?? t("Unknown error");

		super({
			message,
			name: "HoyoLabRequestError",
			args: {
				...(obj.args ?? {}),
				retcode: obj.retcode ?? null
			}
		});
	}

	static get name () {
		return "HoyoLabRequestError";
	}
}

module.exports = Error;
