module.exports = class ClassTemplate {
	destroy () {
		throw new Error("destroy() is not implemented");
	}

	static data = [];

	static async initialize () {
		await this.loadData();
		return this;
	}

	static async loadData () {
		throw new app.Error({
			message: "loadData() must be implemented in the child class",
			args: {
				name: this.name
			}
		});
	}

	static async importData (definitions) {
		if (this.data && this.data.length !== 0) {
			for (const instance of this.data) {
				instance.destroy();
			}

			this.data = [];
		}

		this.data = definitions.map(i => new this(i));
	}
};
