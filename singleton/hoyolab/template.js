module.exports = class HoyoLabTemplate {
	static destroy () {}

	static async checkAndExecute () {
		throw new app.Error({
			message: "Method must be implemented in child class"
		});
	}
};
