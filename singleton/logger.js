const debug = require("debug");

module.exports = class LoggerSingleton {
	log (namespace, message, options = {}) {
		const logger = debug(`[${namespace}]`);

		logger.color = options.color ?? 34;
		logger(message);
	}

	info (namespace, message, options = {}) {
		const logger = debug(`[${namespace}]`);

		logger.color = options.color ?? logger.color;
		logger(message);
	}

	warn (namespace, message, options = {}) {
		const logger = debug(`[${namespace}]`);

		logger.color = options.color ?? 9;
		logger(message);
	}

	error (namespace, message, options = {}) {
		const logger = debug(`[${namespace}]`);

		logger.color = options.color ?? 196;
		logger(message);
	}
};
