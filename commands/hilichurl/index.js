const createEmbed = (result) => {
	const fields = [];

	if (result.tasksClaimed.length > 0) {
		const totalPoints = result.tasksClaimed.reduce((sum, t) => sum + t.points, 0);
		fields.push(
			{
				name: "🎯 Tasks Claimed",
				value: result.tasksClaimed.map(t => `• ${t.name} (+${t.points})`).join("\n").slice(0, 1024) || "None",
				inline: false
			},
			{
				name: "💰 Points Earned",
				value: `+${totalPoints} pts`,
				inline: true
			}
		);
	}

	if (result.freeItemsClaimed?.length > 0) {
		fields.push({
			name: "🆓 Free Items Claimed",
			value: result.freeItemsClaimed.map(i => `• ${i}`).join("\n").slice(0, 1024),
			inline: false
		});
	}

	if (result.itemsExchanged.length > 0) {
		fields.push({
			name: "🎁 Items Exchanged",
			value: result.itemsExchanged.map(i => `• ${i.name} (-${i.cost} pts)`).join("\n").slice(0, 1024),
			inline: false
		});
	}

	if (result.codesRedeemed.length > 0) {
		fields.push({
			name: "✅ Codes Redeemed",
			value: result.codesRedeemed.map(c => `\`${c}\``).join(", ").slice(0, 1024),
			inline: false
		});
	}

	if (result.codesObtained?.length > 0) {
		fields.push({
			name: "🎫 Codes Obtained",
			value: result.codesObtained.map(c => `\`${c}\``).join("\n").slice(0, 1024),
			inline: false
		});
	}

	fields.push({
		name: "💎 Current Points",
		value: `${result.points} pts`,
		inline: true
	});

	const hasActivity = result.tasksClaimed.length > 0
		|| result.freeItemsClaimed?.length > 0
		|| result.itemsExchanged.length > 0
		|| result.codesRedeemed.length > 0;

	return {
		color: 0x0099FF, // Genshin blue
		title: "🔧 Hilichurl Machine Workshop",
		author: {
			name: `${result.nickname} (${result.uid})`,
			icon_url: result.assets?.logo
		},
		description: hasActivity
			? "Successfully ran Hilichurl Workshop automation for Genshin Impact!"
			: "No new activity for Genshin Impact.",
		fields,
		thumbnail: {
			url: result.assets?.logo
		},
		timestamp: new Date().toISOString(),
		footer: {
			text: "Genshin Impact",
			icon_url: result.assets?.logo
		}
	};
};

module.exports = {
	name: "hilichurl",
	description: "Manually run Hilichurl Machine Workshop automation for Genshin Impact.",
	params: [],
	run: (async function hilichurl (context) {
		const { interaction } = context;

		const accounts = app.HoyoLab.getActiveAccounts({ whitelist: "genshin" });
		if (accounts.length === 0) {
			const message = "No Genshin Impact accounts found.";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		const genshinPlatform = app.HoyoLab.get("genshin");
		if (!genshinPlatform || typeof genshinPlatform.hilichurl !== "function") {
			const message = "Hilichurl Workshop is not available.";
			return interaction
				? interaction.reply({ content: message, ephemeral: true })
				: { success: false, reply: message };
		}

		if (interaction) {
			await interaction.deferReply({ ephemeral: true });
		}

		const results = [];
		const errors = [];

		for (const account of accounts) {
			try {
				app.Logger.info("Command:Hilichurl", `Running Hilichurl for Genshin - ${account.uid}`);

				const result = await genshinPlatform.hilichurl(account);
				if (!result.success) {
					errors.push({
						uid: account.uid,
						error: result.message || "Unknown error"
					});
					continue;
				}

				results.push({
					uid: account.uid,
					nickname: account.nickname,
					...result.data
				});
			}
			catch (e) {
				app.Logger.error("Command:Hilichurl", {
					message: "Hilichurl automation failed",
					uid: account.uid,
					error: e.message
				});
				errors.push({
					uid: account.uid,
					error: e.message
				});
			}
		}

		if (results.length === 0 && errors.length === 0) {
			const message = "No Genshin accounts available for Hilichurl Workshop.";
			return interaction
				? interaction.editReply({ content: message })
				: { success: false, reply: message };
		}

		const embeds = results.map(r => createEmbed(r));

		if (errors.length > 0) {
			embeds.push({
				color: 0xFF0000,
				title: "❌ Errors",
				description: errors.map(e => `• **Genshin** (${e.uid}): ${e.error}`).join("\n").slice(0, 4096)
			});
		}

		if (interaction) {
			await interaction.editReply({ embeds: embeds.slice(0, 10) });
			return;
		}

		const summaryLines = results.map(r => `GI - ${r.nickname}: ${r.points} pts`);
		return { success: true, reply: summaryLines.join("\n") };
	})
};
