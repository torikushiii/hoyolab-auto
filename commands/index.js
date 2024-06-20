const loadCommands = (async function () {
	const { platform } = require("node:os");
	const fs = require("node:fs/promises");
	const path = require("node:path");

	const commandList = await fs.readdir(__dirname, {
		withFileTypes: true
	});

	const definitions = [];
	const failed = [];

	const dirList = commandList.filter((entry) => entry.isDirectory());
	for (const dir of dirList) {
		let def;

		let defPath = path.join(__dirname, dir.name, "index.js");
		if (platform() === "win32") {
			defPath = path.win32.normalize(defPath);
		}

		try {
			def = require(defPath);
		}
		catch {
			failed.push(dir.name);
		}

		if (def) {
			definitions.push(def);
		}
	}

	return {
		definitions,
		failed
	};
});

module.exports = {
	loadCommands
};
