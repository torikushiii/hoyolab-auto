const API = require("./api/index.js");
const FakeAgent = require("./fake-agent/index.js");
const Global = require("./global/index.js");
const HoyoClient = require("./hoyo-client/index.js");
const HoyoLab = require("./hoyolab/index.js");

const definitions = [
	API,
	FakeAgent,
	Global,
	HoyoClient,
	HoyoLab
];

module.exports = definitions;
