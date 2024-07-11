const Game8Resolver = require("./game8");
const PCGamerResolver = require("./pcgamer");
const PCGamesNResolver = require("./pcgames");
const ReadWriteResolver = require("./readwrite");

const fetch = async () => {
	const promises = await Promise.allSettled([
		Game8Resolver.fetch(),
		PCGamerResolver.fetch(),
		PCGamesNResolver.fetch(),
		ReadWriteResolver.fetch()
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
