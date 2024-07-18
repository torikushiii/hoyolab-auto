const file = require("node:fs");
const JSON5 = require("json5");

const config = require("./config.js");

function kebabToCamelCase (object) {
	for (const key of Object.keys(object)) {
		if (object[key] && typeof object[key] === "object" && !Array.isArray(object[key])) {
			kebabToCamelCase(object[key]);
		}

		const convertedKey = key.replace(/-./g, match => match[1].toUpperCase());

		if (key !== convertedKey) {
			object[convertedKey] = object[key];
			delete object[key];
		}
	}
}

kebabToCamelCase(config);

file.writeFileSync("./config.json5", JSON5.stringify(config, null, 4));
console.log("config.js converted to config.json5");
