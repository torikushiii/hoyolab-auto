const Game8Resolver = require("./game8.js");
const GenshinFandomResolver = require("./genshin-fandom.js");

const fetch = async () => {
	const promises = await Promise.allSettled([
		Game8Resolver.fetch(),
		GenshinFandomResolver.fetch()
	]);

	const codes = [];
	for (const promise of promises) {
		if (promise.status === "rejected") {
			continue;
		}

		codes.push(...promise.value);
	}

	return codes.flat();
};

module.exports = {
	fetch
};
