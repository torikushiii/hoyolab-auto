const API = require("./api/index.js");
const FakeAgent = require("./fake-agent/index.js");
const Global = require("./global/index.js");
const HoyoLabContexts = require("./hoyolab-contexts/index.js");

const definitions = [
	API,
	FakeAgent,
	Global,
	...HoyoLabContexts
];

module.exports = definitions;
