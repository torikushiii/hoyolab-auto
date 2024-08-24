module.exports = class HoyoDate extends Date {
	static REGION_OFFSETS = {
		SEA: 480, // GMT+8
		EU: 60, // GMT+1
		NA: -300, // GMT-5
		GLOBAL: 540 // GMT+9
	};


	constructor (...args) {
		if (args.length > 1 && args.every(i => typeof i === "number")) {
			args[1] = args[1] - 1;
		}

		super(...args);
	}

	setTimezoneOffset (offset) {
		if (typeof offset === "string") {
			offset = HoyoDate.REGION_OFFSETS[offset.toUpperCase()];
			if (offset === undefined) {
				throw new Error("Invalid region. Use 'ASIA', 'EU', or 'AMERICA'");
			}
		}
		else {
			offset = Number(offset);
			if (Number.isNaN(offset)) {
				throw new Error("Invalid offset");
			}
			else if (offset % 15 !== 0) {
				throw new Error("Unrecognized offset - make sure to use offset in minutes");
			}
		}

		this.setMinutes(this.getMinutes() + this.getTimezoneOffset() + offset);
		return this;
	}

	discardTimeUnits (...units) {
		for (const unit of units) {
			switch (unit) {
				case "h":
					this.setHours(0);
					break;
				case "m":
					this.setMinutes(0);
					break;
				case "s":
					this.setSeconds(0);
					break;
				case "ms":
					this.setMilliseconds(0);
					break;
				default:
					throw new Error(`Unrecognized time unit ${unit}`);
			}
		}
		return this;
	}

	clone () {
		return new this.constructor(this);
	}

	addHours (h) {
		this.hours += h;
		return this;
	}

	get hours () {
		return super.getHours();
	}

	set hours (h) {
		super.setHours(h);
	}
};
