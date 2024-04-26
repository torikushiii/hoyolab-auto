module.exports = class Config extends require("./template.js") {
	#name;
	#value;

	static data = new Map();

	constructor (data) {
		super();

		this.#name = data.name;

		this.#value = data.value;
	}

	get name () { return this.#name; }
	get value () { return this.#value; }

	static async initialize () {
		Config.data = new Map();
		await Config.loadData();
		return Config;
	}

	static async load (data) {
		const loaded = new Set();

		for (const [name, value] of Object.entries(data)) {
			const object = new Config({ name, value });

			Config.data.set(name, object);
			loaded.add(name);
		}
	}

	static has (name) {
		const target = Config.get(name);

		return target !== undefined;
	}

	static get (name) {
		const target = Config.data.get(name);

		if (!target) {
			return undefined;
		}

		return target.value;
	}
};
