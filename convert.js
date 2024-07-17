const file = require("fs");
const JSON5 = require("json5");

const config = require("./config.js");

const jsonString = JSON5.stringify(config, null, 4);

file.writeFileSync("./config.json5", jsonString);
console.log("Config file converted to JSON5!");