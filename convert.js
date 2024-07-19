const fs = require("node:fs");
const path = require("node:path");
const JSON5 = require("json5");

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

function removeComments (jsonc) {
	return jsonc.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").trim();
}

function convertConfig (filePath, outputFilePath) {
	const fileContent = fs.readFileSync(filePath, "utf8");
	let config;

	if (filePath.endsWith(".js")) {
		config = require(filePath);
	}
	else if (filePath.endsWith(".jsonc")) {
		const cleanedContent = removeComments(fileContent);
		config = JSON.parse(cleanedContent);
	}
	else {
		throw new Error("Unsupported file format. Only .js and .jsonc files are supported.");
	}

	kebabToCamelCase(config);

	fs.writeFileSync(outputFilePath, JSON5.stringify(config, null, 4));
	console.log(`${filePath} converted to ${outputFilePath}`);
}

function autoConvert () {
	const directoryPath = path.resolve(__dirname);
	const jsFilePath = path.join(directoryPath, "config.js");
	const jsoncFilePath = path.join(directoryPath, "config.jsonc");

	if (fs.existsSync(jsFilePath)) {
		convertConfig(jsFilePath, path.join(directoryPath, "config.json5"));
	}
	else if (fs.existsSync(jsoncFilePath)) {
		convertConfig(jsoncFilePath, path.join(directoryPath, "config.json5"));
	}
	else {
		console.error("No config.js or config.jsonc file found in the directory.");
	}
}

autoConvert();
