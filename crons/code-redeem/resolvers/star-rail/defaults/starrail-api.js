let version;

exports.fetch = async () => {
	if (typeof version === "undefined") {
		try {
			const { execSync } = require("child_process");
			const hash = execSync("git rev-parse --short HEAD").toString().trim();

			version = `HoyoLabAuto@${hash}`;
		}
		catch {
			version = "HoyoLabAuto";
		}
	}

	const res = await app.Got("API", {
		url: "https://api.ennead.cc/starrail/code",
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			"User-Agent": version
		}
	});

	if (res.statusCode !== 200) {
		app.Logger.log("StarRail:StarRailAPI", {
			statusCode: res.statusCode
		});

		return [];
	}

	const codes = res.body.active;
	if (!Array.isArray(codes)) {
		return [];
	}

	app.Logger.debug("StarRail:StarRailAPI", {
		message: `Found ${codes.length} codes.`,
		codes
	});

	return codes.map(i => ({
		code: i.code,
		rewards: i.rewards,
		source: "starrail-api"
	}));
};
