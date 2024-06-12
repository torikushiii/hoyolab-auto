const DEFAULT_CONSTANTS = {
	ACT_ID: "",
	successMessage: "",
	signedMessage: "",
	assets: {
		author: "",
		game: ""
	},
	url: {
		info: "",
		home: "",
		sign: "",
		notes: "",
		redemption: ""
	}
};

module.exports = class ZenlessZoneZero extends require("./template.js") {
	#logo;
	#color;

	constructor (config) {
		super("nap", config, {
			gameId: 0,
			config: DEFAULT_CONSTANTS
		});

		if (!this.id) {
			throw new app.Error({
				message: "No game ID provided for ZenlessZoneZero."
			});
		}
		if (this.data.length === 0) {
			throw new app.Error({
				message: "No ZenlessZoneZero account data provided."
			});
		}
	}
};
