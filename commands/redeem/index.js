module.exports = {
	name: "redeem",
	description: "Redeem provided codes for the specified game.",
	params: null,
	run: (async function redeem (context, game, ...codes) {
		const validGames = app.HoyoLab.supportedGames({ blacklist: "honkai" });
		if (!game) {
			return {
				success: false,
				reply: `No game provided. Valid games are: ${validGames.join(", ")}`
			};
		}
		if (codes.length === 0) {
			return {
				success: false,
				reply: "No codes provided."
			};
		}

		if (game === "zenless" || game === "zzz") {
			game = "nap";
		}

		codes = codes.map(code => code.toUpperCase());

		const res = await app.HoyoLab.redeemCode(game, codes);
		if (!res.success) {
			return {
				success: false,
				reply: res.reply
			};
		}

		let reply = "";
		if (res.success.length > 0) {
			reply += "**Successfully redeemed codes:**\n";
			reply += `\`\`\`\n${res.success.map(i => `${i.uid}`).join("\n")}\`\`\``;
		}

		if (res.failed.length > 0) {
			reply += "\n**Failed Code Redemption(s):**\n";
			reply += `\`\`\`\n${res.failed.map(i => `${i.uid} - ${i.reason}`).join("\n")}\`\`\``;
		}

		return {
			success: true,
			reply
		};
	})
};
