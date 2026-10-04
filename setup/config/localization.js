/* eslint-env browser */
/* global HoyoLabI18n, HoyoLabCatalogFiles */
const catalogLoads = new Map();
let languageUpdate = 0;

function loadCatalogScript (filename) {
	if (!catalogLoads.has(filename)) {
		catalogLoads.set(filename, new Promise((resolve) => {
			const script = document.createElement("script");
			script.src = new URL(`../../localization/${filename}`, document.baseURI);
			script.onload = () => resolve(true);
			script.onerror = () => {
				script.remove();
				resolve(false);
			};
			document.head.appendChild(script);
		}));
	}
	return catalogLoads.get(filename);
}

async function ensureCatalog (language) {
	for (const candidate of HoyoLabI18n.getCatalogCandidates(language)) {
		if (candidate === "en" || HoyoLabI18n.hasCatalog(candidate, true)) {
			return;
		}
		if (Object.hasOwn(HoyoLabCatalogFiles, candidate)) {
			const filename = HoyoLabCatalogFiles[candidate];
			if (await loadCatalogScript(filename) && HoyoLabI18n.hasCatalog(candidate, true)) {
				return;
			}
		}
	}
}

globalThis.setLocalizedText = function (element, message, ...values) {
	element.dataset.i18n = message;
	element.dataset.i18nValues = JSON.stringify(values);
	element.textContent = HoyoLabI18n.t(message, ...values);
};

function localizeForm (root = document) {
	for (const element of root.querySelectorAll("[data-i18n]")) {
		const values = JSON.parse(element.dataset.i18nValues || "[]");
		element.textContent = HoyoLabI18n.t(element.dataset.i18n, ...values);
	}
}

globalThis.updateLanguage = async function () {
	const sequence = ++languageUpdate;
	const language = document.getElementById("language").value;
	HoyoLabI18n.setLanguage(language);
	await ensureCatalog(language);
	if (sequence !== languageUpdate) {
		return;
	}
	HoyoLabI18n.setLanguage(language);
	document.documentElement.lang = HoyoLabI18n.getLocale();
	localizeForm();
};
