const definition = {
	name: "API",
	optionsType: "function",
	options: (() => ({
		mutableDefaults: true,
		throwHttpErrors: true,
		hooks: {
			beforeError: [
				(e) => new app.Error.GenericRequest({
					body: e.response?.body ?? null,
					statusCode: e.response?.statusCode,
					statusMessage: e.response?.statusMessage,
					hostname: e.options?.url?.hostname,
					message: e.message,
					stack: e.stack
				})
			]
		}
	})),
	parent: "Global"
};

module.exports = definition;
