const API = require("./api/index.js");
const FakeAgent = require("./fake-agent/index.js");
const Global = require("./global/index.js");
const HoyoClient = require("./hoyo-client/index.js");
const HoyoLab = require("./hoyolab/index.js");
const MiHoYo = require("./mihoyo/index.js");

const definitions = [
	API,
	FakeAgent,
	Global,
	HoyoClient,
	HoyoLab,
	MiHoYo
];

module.exports = definitions;
