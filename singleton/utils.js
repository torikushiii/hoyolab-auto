const crypto = require("crypto");

module.exports = class UtilsSingleton {
	static DS_SALT = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
	
	static timeUnits = {
		h: { m: 60, s: 3600, ms: 3600.0e3 },
		m: { s: 60, ms: 60.0e3 },
		s: { ms: 1.0e3 }
	};

	/**
	 * @inheritdoc
	 * @returns {UtilsSingleton}
	 */
	static singleton () {
		if (!UtilsSingleton.module) {
			UtilsSingleton.module = new UtilsSingleton();
		}

		return UtilsSingleton.module;
	}

	formatTime (seconds = 0) {
		const array = [];

		if (seconds >= UtilsSingleton.timeUnits.h.s) {
			const hours = Math.floor(seconds / UtilsSingleton.timeUnits.h.s);
			seconds -= hours * UtilsSingleton.timeUnits.h.s;
			array.push(`${hours} hr`);
		}
        
		if (seconds >= UtilsSingleton.timeUnits.m.s) {
			const minutes = Math.floor(seconds / UtilsSingleton.timeUnits.m.s);
			seconds -= minutes * UtilsSingleton.timeUnits.m.s;
			array.push(`${minutes} min`);
		}

		if (seconds >= 0 || array.length === 0) {
			array.push(`${this.round(seconds, 3)} sec`);
		}

		return array.join(", ");
	}

	round (number, precision = 0) {
		return Math.round(number * (10 ** precision)) / (10 ** precision);
	}

	formattedAccountRegion (region) {
		switch (region) {
			case "prod_official_cht":
				return "TW";
			case "os_asia":
			case "prod_official_asia":
				return "SEA";
			case "prod_official_eur":
				return "EU";
			case "prod_official_usa":
				return "NA";
			default:
				return "Unknown";
		}
	}

	escapeCharacters (string) {
		return string.replace(/[_[\]()~`>#+\-=|{}.!]/g, "\\$&");
	}

	assets (platform) {
		const assets = {
			genshin: {
				game: "Genshin Impact",
				author: "Paimon",
				icon: "https://fastcdn.hoyoverse.com/static-resource-v2/2023/11/08/9db76fb146f82c045bc276956f86e047_6878380451593228482.png"
			},
			starrail: {
				game: "Honkai: Star Rail",
				author: "PomPom",
				icon: "https://webstatic-sea.hoyolab.com/communityweb/business/starrail_hoyoverse.png"
			}
		};

		return assets[platform];
	}

	generateDS () {
		const time = (Date.now() / 1000).toFixed(0);
		const random = this.randomString();
		const hash = this.hash(`salt=${UtilsSingleton.DS_SALT}&t=${time}&r=${random}`);

		return `${time},${random},${hash}`;
	}

	fieldsBuilder (data, options = {}) {
		const fields = [];
		for (const key in data) {
			if (Object.hasOwnProperty.call(data, key)) {
				const value = data[key];
				fields.push({ name: this.capitalize(key), value, inline: options[key] ?? true });
			}
		}

		return fields;
	}

	capitalize (string) {
		return string[0].toUpperCase() + string.substring(1);
	}

	randomString () {
		let result = "";
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		const length = 6;

		for (let i = 0; i < length; i++) {
			result += chars[Math.floor(Math.random() * chars.length)];
		}

		return result;
	}

	hash (string) {
		return crypto
			.createHash("md5")
			.update(string)
			.digest("hex");
	}
};
