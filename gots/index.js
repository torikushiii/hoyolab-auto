const FakeAgent = require("./fake-agent/index.js");
const Global = require("./global/index.js");
const HoyoLab = require("./hoyolab/index.js");

const definitions = [
	FakeAgent,
	Global,
	HoyoLab
];

module.exports = definitions;
