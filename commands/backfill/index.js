const { t } = require("../../localization/index.js");

const formatTarget = ({ account, success, failed, skipped }) => {
	const parts = [];
	if (success.length > 0) {
		parts.push(t `redeemed ${success.map(i => i.code.code).join(", ")}`);
	}
	if (skipped.length > 0) {
		parts.push(t `already used or expired ${skipped.map(i => i.code.code).join(", ")}`);
	}
	if (failed.some(i => i.loginExpired)) {
		parts.push(t("HoYoLAB login expired, update your cookie"));
	}
	else if (failed.length > 0) {
		parts.push(t `failed ${failed.map(i => `${i.code.code} (${i.reason})`).join(", ")}`);
	}

	return `${app.HoyoLab.getRegion(account.region)} (${account.uid}): ${parts.join("; ") || t("nothing to redeem")}`;
};

module.exports = {
	name: "backfill",
	description: t("Redeem every active code an account has not redeemed yet, on all of its servers."),
	params: [
		{
			name: "game",
			description: t("The game you want to redeem codes for."),
			type: "string",
			choices: [
				{ name: "Genshin Impact", value: "genshin" },
				{ name: "Honkai: Star Rail", value: "starrail" },
				{ name: "Zenless Zone Zero", value: "nap" }
			],
			required: true
		},
		{
			name: "account",
			description: t("Select the account you want to redeem codes for."),
			type: "string",
			required: true,
			accounts: true
		}
	],
	run: (async function backfill (context, game, uid) {
		const { interaction } = context;
		const reply = async (success, content) => {
			if (interaction) {
				return interaction.deferred
					? await interaction.editReply({ content })
					: await interaction.reply({ content, ephemeral: true });
			}
			return { success, reply: content };
		};

		if (game === "zenless" || game === "zzz") {
			game = "nap";
		}
		if (!["genshin", "starrail", "nap"].includes(game)) {
			return await reply(false, t `No game provided. Supported games are: ${"genshin, starrail, nap"}`);
		}

		const [account] = app.HoyoLab.getActiveAccounts({ whitelist: game, uid });
		if (!account) {
			return await reply(false, t("No active accounts found for this type of game."));
		}
		if (account.redeemCode === false) {
			return await reply(false, t("Redeem code functionality is currently disabled for this account."));
		}

		if (interaction) {
			await interaction.deferReply({ ephemeral: true });
		}

		const { backfillAccount } = require("../../crons/code-redeem/utils.js");
		const result = await backfillAccount(game, uid);
		if (!result || result.activeCodes.length === 0) {
			return await reply(false, t("No active codes found."));
		}

		const ok = result.targets.every(i => i.failed.length === 0);
		return await reply(ok, result.targets.map(formatTarget).join("\n"));
	})
};
