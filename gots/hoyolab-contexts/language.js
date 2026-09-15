// Keep the configured preference intact; endpoints choose where to serialize it.
const getLanguage = () => app.Config.get("language") || "en-us";

// For APIs using a primary language in the query (Genshin redemption).
const getLanguageOnly = () => getLanguage().split("-")[0];

module.exports = { getLanguage, getLanguageOnly };
