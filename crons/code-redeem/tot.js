let version;
const ENDPOINT = "https://api.ennead.cc/mihoyo/themis/codes";

const fetchData = async () => {
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
		url: ENDPOINT,
		responseType: "json",
		throwHttpErrors: false,
		headers: {
			"User-Agent": version
		}
	});

	if (res.statusCode !== 200) {
		app.Logger.debug("TearsOfThemisAPI", {
			statusCode: res.statusCode
		});

		return [];
	}

	const codes = res.body?.active;
	if (!Array.isArray(codes)) {
		app.Logger.debug("TearsOfThemisAPI", {
			message: "API returned malformed data",
			body: res.body
		});

		return [];
	}

	return codes.map((i) => ({
		code: i.code,
		rewards: i.rewards,
		source: "tot-api"
	}));
};

module.exports = {
	fetchData
};
