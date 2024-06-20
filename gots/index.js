const API = require("./api/index.js");
const FakeAgent = require("./fake-agent/index.js");
const Global = require("./global/index.js");
const HoyoLab = require("./hoyolab/index.js");

const definitions = [
	API,
	FakeAgent,
	Global,
	HoyoLab
];

module.exports = definitions;
