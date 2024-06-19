const Game8Resolver = require("./game8");
const StarRailFandomResolver = require("./hsr-fandom");
const StarRailAPIResolver = require("./starrail-api");

const fetch = async () => {
	const promises = await Promise.allSettled([
		Game8Resolver.fetch(),
		StarRailFandomResolver.fetch(),
		StarRailAPIResolver.fetch()
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
