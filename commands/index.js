const loadCommands = (async function () {
	const fs = require("fs/promises");
	const path = require("path");

	const commandList = await fs.readdir(__dirname, {
		withFileTypes: true
	});

	const definitions = [];
	const failed = [];

	const dirList = commandList.filter((entry) => entry.isDirectory());
	for (const dir of dirList) {
		let def;

		const defPath = path.join(__dirname, dir.name, "index.js");
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
