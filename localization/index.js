/* English source messages are the fallback catalog. Interpolated values are never translated. */
(function (root) {
	const catalogs = new Map();
	let language = "en-us";
	let activeCatalog = null;

	function normalizeLanguage (value) {
		return typeof value === "string"
			? value.trim().toLowerCase().replaceAll("_", "-")
			: "en-us";
	}

	function getCatalogCandidates (value) {
		const normalized = normalizeLanguage(value);
		if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(normalized)) {
			return [];
		}
		return [...new Set([normalized, normalized.split("-")[0]])];
	}

	function isValidLocale (value) {
		if (typeof value !== "string") {
			return false;
		}
		try {
			return Intl.getCanonicalLocales(value).length === 1;
		}
		catch {
			return false;
		}
	}

	function registerCatalog (catalog) {
		if (!catalog || typeof catalog !== "object"
			|| typeof catalog.language !== "string"
			|| !isValidLocale(catalog.locale)
			|| !catalog.messages || typeof catalog.messages !== "object" || Array.isArray(catalog.messages)) {
			throw new TypeError("Invalid localization catalog");
		}
		const key = normalizeLanguage(catalog.language);
		if (getCatalogCandidates(key).length === 0) {
			throw new TypeError("Catalog language must be a language or regional locale code");
		}
		catalogs.set(key, Object.freeze({
			language: key,
			locale: catalog.locale,
			messages: Object.freeze({ ...catalog.messages })
		}));
	}

	function loadNodeCatalog (value) {
		if (typeof module !== "object" || !module.exports) {
			return;
		}
		for (const candidate of getCatalogCandidates(value)) {
			if (candidate === "en" || catalogs.has(candidate)) {
				continue;
			}
			const files = require("node:fs").readdirSync(__dirname);
			const expected = `${candidate}.js`;
			const filename = files.includes(expected)
				? expected
				: files.sort().find(file => file.toLowerCase() === expected);
			if (filename) {
				registerCatalog(require(`./${filename}`));
			}
		}
	}

	function setLanguage (value) {
		language = normalizeLanguage(value);
		loadNodeCatalog(language);
		activeCatalog = getCatalogCandidates(language)
			.map(candidate => catalogs.get(candidate))
			.find(Boolean) ?? null;
	}

	function getLocale () {
		return activeCatalog?.locale ?? "en-US";
	}

	function hasCatalog (value, exact = false) {
		return exact
			? catalogs.has(normalizeLanguage(value))
			: getCatalogCandidates(value).some(candidate => catalogs.has(candidate));
	}

	function t (message, ...values) {
		const source = Array.isArray(message)
			? message.reduce((text, part, index) => text + (index ? `{${index - 1}}` : "") + part, "")
			: message;
		const messages = activeCatalog?.messages ?? {};
		const translated = Object.hasOwn(messages, source) ? messages[source] : source;
		return translated.replace(/\{(\d+)\}/g, (match, index) => index < values.length ? String(values[index]) : match);
	}

	// Translate protocol states for display only; keep the cached value unchanged.
	function formatStatus (value) {
		const states = { finished: "Finished", ongoing: "Ongoing", completed: "Completed" };
		const key = String(value).toLowerCase();
		const source = Object.hasOwn(states, key) ? states[key] : undefined;
		return source ? t(source) : value;
	}

	const api = { t, setLanguage, getLocale, hasCatalog, getCatalogCandidates, registerCatalog, formatStatus };
	if (typeof module === "object" && module.exports) {
		module.exports = api;
	}
	else {
		root.HoyoLabI18n = api;
		for (const catalog of Object.values(root.HoyoLabLocales ?? {})) {
			registerCatalog(catalog);
		}
	}
})(globalThis);
