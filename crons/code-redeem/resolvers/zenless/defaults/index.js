const PCGamerResolver = require("./pcgamer");
const ReadWriteResolver = require("./readwrite");

const fetch = async () => {
	const promises = await Promise.allSettled([
		PCGamerResolver.fetch(),
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
