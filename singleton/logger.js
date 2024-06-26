const { createLogger, format, transports, addColors } = require("winston");
const { combine, colorize, timestamp, printf } = format;
const chalk = require("chalk");
const util = require("node:util");

class Logger {
	constructor (config) {
		this.loggerLevels = {
			colors: {
				info: "green",
				error: "underline bold red",
				debug: "bold magenta",
				warn: "yellow"
			}
		};

		this.logFormat = printf(({ level, message, timestamp }) => {
			const sendTarget = `<${level}:${chalk.gray(message.type)}> ${message.text}`;
			return `${chalk.magenta(timestamp)} ${sendTarget}`;
		});

		this.winstonLogger = createLogger({
			format: combine(
				format((info) => {
					info.level = info.level.toUpperCase();
					return info;
				})(),
				timestamp({
					format: "YYYY-MM-DD HH:mm:ss"
				}),
				colorize(),
				this.logFormat
			),
			transports: [
				new transports.Console({
					stderrLevels: ["error"],
					colorize: true
				})
			]
		});

		addColors(this.loggerLevels.colors);

		const logLevel = config ?? "info";
		if (logLevel) {
			this.winstonLogger.transports[0].level = logLevel;
			this.winstonLogger.info({ type: "System", text: `Log level set to ${this.winstonLogger.transports[0].level}` });
		}
		else {
			this.winstonLogger.transports[0].level = "info";
			this.winstonLogger.info({ type: "System", text: `Log level set to ${this.winstonLogger.transports[0].level}` });
		}
	}

	formatMessage (type, text) {
		return { type, text };
	}

	log (type, text) {
		const target = (typeof text === "object") ? util.inspect(text) : text;
		this.winstonLogger.info(this.formatMessage(type, target));
	}

	info (type, text) {
		this.winstonLogger.info(this.formatMessage(type, text));
	}

	error (type, text) {
		this.winstonLogger.error(this.formatMessage(type, text));
	}

	warn (type, text) {
		this.winstonLogger.warn(this.formatMessage(type, text));
	}

	debug (type, text) {
		const target = (typeof text === "object") ? util.inspect(text) : text;
		this.winstonLogger.debug(this.formatMessage(type, target));
	}

	json (type, obj) {
		this.winstonLogger.debug(this.formatMessage(type, util.inspect(obj)));
	}
}

module.exports = Logger;
