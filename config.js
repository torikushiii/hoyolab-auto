const file = require("node:fs");
const JSON5 = require("json5");

const configPath = process.env.CONFIG_PATH || "./config.json5";
let config;
try {
	config = JSON5.parse(file.readFileSync(configPath));
}
catch (e) {
	if (file.existsSync(configPath) === false) {
		throw new Error({
			message: `No config file (${configPath}) was found. Please follow the setup instructions on https://github.com/torikushiii/hoyolab-auto?tab=readme-ov-file#installation \n${e}`
		});
	}

	throw new Error({
		message: `An error occurred when reading your configuration file (${configPath}). Please check and fix the following error:\n${e}`
	});
}

module.exports = config;