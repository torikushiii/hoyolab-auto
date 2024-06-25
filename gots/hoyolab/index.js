const definition = {
	name: "HoyoLab",
	optionsType: "object",
	options: {
		headers: {
			"User-Agent": app.Config.get("userAgent")
		}
	},
	parent: "Global"
};

module.exports = definition;
