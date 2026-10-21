const API = require("./api/index.js");
const Global = require("./global/index.js");
const HoyoLabContexts = require("./hoyolab-contexts/index.js");

const definitions = [
	API,
	Global,
	...HoyoLabContexts
];

module.exports = definitions;
