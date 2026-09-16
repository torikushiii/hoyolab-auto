const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const cheerio = require("cheerio");
const JSON5 = require("json5");
const Config = require("../classes/config.js");
const { getLanguage, getLanguageOnly } = require("../gots/hoyolab-contexts/language.js");

// Execute the actual setup script against its HTML using the existing parser.
// Only DOM operations used by a single-account import/export are adapted here;
// browser file selection, rendering and download UI are not exercised.
const createSetup = () => {
	const html = readFileSync(join(__dirname, "../setup/config/index.html"), "utf8");
	const $ = cheerio.load(html);
	let download;
	const wrap = (element) => {
		if (!element.length) {
			return null;
		}
		return {
			get value () { return element.val(); },
			set value (value) { element.val(value); },
			get placeholder () { return element.attr("placeholder"); },
			set textContent (value) { element.text(value); },
			classList: {
				add: (...names) => element.addClass(names.join(" ")),
				remove: (...names) => element.removeClass(names.join(" "))
			},
			addEventListener: () => {},
			querySelector: (selector) => wrap(element.find(selector).first()),
			querySelectorAll: (selector) => element.find(selector).toArray().map(node => wrap($(node)))
		};
	};
	const context = {
		JSON5,
		Blob,
		URL: { createObjectURL: (blob) => {
			download = blob;
			return "blob:synthetic-config";
		} },
		document: {
			getElementById: (id) => wrap($(`[id="${id}"]`).first()),
			querySelector: (selector) => wrap($(selector).first()),
			querySelectorAll: (selector) => $(selector).toArray().map(node => wrap($(node))),
			body: { appendChild: () => {}, removeChild: () => {} },
			createElement: (tag) => {
				assert.equal(tag, "a");
				return {
					click () { assert.equal(this.download, "config.json5"); }
				};
			}
		}
	};
	runInNewContext($("script:not([src])").text(), context);
	return { context, exportedText: () => download.text() };
};

for (const [language, expected, short] of [
	[undefined, "en-us", "en"],
	["it-it", "it-it", "it"],
	["future-region", "future-region", "future"]
]) {
	test(`setup and Config preserve canonical locale: ${String(language)}`, async (t) => {
		const previousApp = global.app;
		const previousData = Config.data;
		const previousPath = process.env.CONFIG_PATH;
		const configModule = require.resolve("../config.js");
		const previousModule = require.cache[configModule];
		const directory = mkdtempSync(join(tmpdir(), "hoyolab-locale-"));
		t.after(() => {
			global.app = previousApp;
			Config.data = previousData;
			if (previousPath === undefined) {
				delete process.env.CONFIG_PATH;
			}
			else {
				process.env.CONFIG_PATH = previousPath;
			}
			delete require.cache[configModule];
			if (previousModule) {
				require.cache[configModule] = previousModule;
			}
			rmSync(directory, { recursive: true });
		});
		global.app = { Config };
		const setup = createSetup();
		let text = JSON5.stringify(language === undefined ? {} : { language });
		process.env.CONFIG_PATH = join(directory, "config.json5");
		// Check initial config loading, then two complete setup import/export cycles.
		for (let cycle = 0; cycle < 3; cycle++) {
			writeFileSync(process.env.CONFIG_PATH, text);
			delete require.cache[configModule];
			Config.data = new Map();
			await Config.load(require(configModule));
			assert.equal(Config.get("language"), cycle === 0 ? language : expected);
			assert.equal(getLanguage(), expected);
			assert.equal(getLanguageOnly(), short);
			assert.equal(Config.get("language"), cycle === 0 ? language : expected);
			if (cycle < 2) {
				setup.context.importConfigFromText(text);
				assert.equal(setup.context.document.getElementById("language").value, expected);
				setup.context.generateConfig();
				text = await setup.exportedText();
				assert.equal(JSON5.parse(text).language, expected);
			}
		}
	});
}
