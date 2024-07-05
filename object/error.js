class Error extends globalThis.Error {
	#args;
	#timestamp;
	#messageDescriptor;

	constructor (obj = {}) {
		if (obj.constructor !== Object) {
			throw new globalThis.Error("obj must be an object to receive as params");
		}

		if (typeof obj.message !== "string") {
			throw new globalThis.Error("message must be a string");
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
					parts.push(`- args: ${JSON.stringify(this.#args)}`);
				}

				if (this.cause) {
					const causeMessage = `cause: ${this.cause.message ?? "(no message)"} ${this.cause.stack ?? "(no stack)"}`;
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
			1009: "The account does not exist",
			"-100": "The provided cookie is either invalid or expired.",
			"-10001": "The provided cookie is either invalid or expired.",
			"-10101": "Cannot get data after more than 30 accounts per cookie per day.",
			"-1048": "API system is busy, please try again later.",
			"-1071": "The provided cookie is either invalid or expired.",
			"-2001": "The code has expired",
			"-2003": "The code is invalid",
			"-2016": "Redemption is in cooldown",
			"-2017": "The code has been used"
		};

		const CaptchaCodes = [
			10035,
			5003,
			10041,
			1034
		];

		const isCaptchaCode = CaptchaCodes.includes(obj.retcode);
		const message = (isCaptchaCode)
			? "A captcha challenge was requested. Please solve it and try again."
			: errorMessages[obj.retcode] ?? "Unknown error";

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
