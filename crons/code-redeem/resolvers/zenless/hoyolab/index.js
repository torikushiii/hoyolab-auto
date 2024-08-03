const ApiResolver = require("./api-resolver");

const fetch = async () => {
	const codes = await ApiResolver.fetch();
	return codes;
};

module.exports = {
	fetch
};
