module.exports = {
	name: "update-cookie",
	expression: "0 */2 * * *",
	description: "Update cookie for all accounts",
	code: (async function updateCookie () {
		await app.HoyoLab.refreshStoredCookies();
	})
};
