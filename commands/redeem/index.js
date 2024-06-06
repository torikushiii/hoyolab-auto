module.exports = {
	name: "redeem",
	description: "Redeem provided codes for the specified game.",
	params: null,
	run: (async function redeem (context, game, ...codes) {
		if (!game) {
			return {
				success: false,
				reply: `No game provided. Valid games are: ${app.HoyoLab.supportedGames({
					blacklist: ["honkai"]
				})}`
			};
		}
		if (codes.length === 0) {
			return {
				success: false,
				reply: "No codes provided."
			};
		}
		if (game === "genshin") {
			return {
				reply: "Not yet implemented."
			};
		}

		codes = codes.map(code => code.toUpperCase());

		const res = await app.HoyoLab.redeemCode(game, codes);
		if (!res.success) {
			return {
				success: false,
				reply: res.reply
			};
		}

		if (res.success.length === 0) {
			const message = [
				`\`\`\`Failed Code Redemption(s):\n${res.failed.map(i => `${i.uid} - ${i.reason}`).join("\n")}\`\`\``
			].join("\n");

			return {
				success: false,
				reply: `No codes were successfully redeemed.\n${message}`
			};
		}

		let reply = "Successfully redeemed codes";
		if (res.failed.length > 0) {
			const message = [
				`\`\`\`Failed Code Redemption(s):\n${res.failed.map(i => `${i.uid} - ${i.reason}`).join("\n")}\`\`\``
			].join("\n");

			reply = `${reply}, with ${res.failed.length} failed redemption(s).\n${message}`;
		}

		return {
			success: true,
			reply
		};
	})
};
