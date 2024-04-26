module.exports = class Discord extends require("./template.js") {
	#token;
	#active = false;

	constructor () {
		super();

		throw new app.Error({ message: "Discord controller is not implemented yet." });
	}
};
