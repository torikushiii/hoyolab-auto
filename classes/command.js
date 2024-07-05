module.exports = class Command extends require("./template.js") {
	name;
	description = null;
	params = [];
	code;

	data = {};

	constructor (data) {
		super();

		this.name = data.name;
		if (typeof this.name !== "string" || this.name.length === 0) {
			console.error("Command name must be a string and not empty", this.name);
			this.name = "";
		}

		this.description = data.description;

		if (data.params !== null) {
			let params = data.params;
			if (typeof params === "string") {
				try {
					params = JSON.parse(params);
				}
				catch (e) {
					this.params = null;
					app.Logger.log("Command", {
						message: "Command parameters are not valid JSON",
						data: {
							name: this.name,
							error: e
						}
					});
				}
			}

			this.params = params;
		}

		if (typeof data.run === "function") {
			this.code = data.run;
		}
		else {
			try {
				this.code = eval(data.run);
			}
			catch (e) {
				console.error(`Failed to compile code for ${this.name}`, e);
				this.code = () => ({
					success: false,
					reply: "Failed to compile code"
				});
			}
		}
	}

	destroy () {
		this.code = null;
		this.data = null;
	}

	execute (...args) {
		return this.code(...args);
	}

	static async initialize () {
		return this;
	}

	static async importData (definitions) {
		super.importData(definitions);
		await this.validate();
	}

	static async validate () {
		if (Command.data.length === 0) {
			app.Logger.warn("Command", "No commands loaded");
		}

		if (!app.Config) {
			app.Logger.warn("Command", "No configuration data found");
		}
		else if (Command.prefix === null) {
			app.Logger.warn("Command", "No command prefix found");
		}

		const names = Command.data.flatMap(i => i.name);
		const duplicates = names.filter((i, index) => names.indexOf(i) !== index);
		if (duplicates.length > 0) {
			console.warn("Duplicate command name found", duplicates);
		}
	}

	static get (name) {
		if (name instanceof Command) {
			return name;
		}
		else if (typeof name === "string") {
			return Command.data.find(i => i.name === name);
		}
		else {
			throw new app.Error({
				message: "Invalid command name",
				args: {
					type: typeof name,
					name
				}
			});
		}
	}

	static async checkAndRun (identifier, argumentArray, channelData, userData, options = {}) {
		if (!identifier) {
			return {
				success: false,
				reply: "No command name specified"
			};
		}

		if (!Array.isArray(argumentArray)) {
			throw new app.Error({ message: "Invalid argument array" });
		}

		const command = Command.get(identifier);
		if (!command) {
			return {
				success: false,
				reply: "Command not found"
			};
		}

		const appendOptions = { ...options };
		const contextOptions = {
			platform: options.platform,
			invocation: identifier,
			user: userData,
			channel: channelData,
			command,
			append: appendOptions,
			params: {}
		};

		const whitespaceRegex = /\s+/;
		const args = argumentArray
			.map(i => i.replace(whitespaceRegex, ""))
			.filter(Boolean);

		let execution;
		try {
			execution = await command.code(contextOptions, ...args);
		}
		catch (e) {
			const logObject = {
				message: "Command execution failed",
				data: {
					command: command.name,
					invocation: identifier,
					platform: options.platform.id,
					args,
					error: e
				}
			};

			app.Logger.log("Command", logObject);

			execution = {
				success: false,
				reply: "An error occurred while executing the command"
			};
		}

		if (!execution) {
			return execution;
		}

		execution.reply = String(execution.reply).trim();

		if (execution.reply.length === 0) {
			execution.reply = "(empty response)";
		}

		return execution;
	}

	static is (string) {
		const prefix = Command.getPrefix();
		if (prefix === null) {
			return false;
		}

		return (string.startsWith(prefix) && string.length > prefix.length);
	}

	static get prefix () {
		return Command.getPrefix();
	}

	static getPrefix () {
		return app.Config.get("prefix") ?? null;
	}
};
