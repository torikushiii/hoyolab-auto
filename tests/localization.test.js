const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseSync } = require("@babel/core");
const { t, setLanguage, getLocale, getCatalogCandidates, registerCatalog, formatStatus } = require("../localization/index.js");
const italian = require("../localization/it.js");
const Config = require("../classes/config.js");
const root = path.resolve(__dirname, "..");

afterEach(() => {
	setLanguage();
	Config.data.clear();
	delete globalThis.app;
});

test("locale fallback leaves the API configuration untouched", async () => {
	for (const language of [undefined, "", "en-us", "ja-jp", "constructor", 42]) {
		await Config.load({ language });
		assert.equal(getLocale(), "en-US");
		assert.equal(t("Today's Reward"), "Today's Reward");
		assert.equal(Config.get("language"), language);
	}
	for (const language of ["it-it", "it-CH", " IT_it ", "it"]) {
		await Config.load({ language });
		assert.equal(getLocale(), "it-IT");
		assert.equal(t("Today's Reward"), "Ricompensa di oggi");
		assert.equal(Config.get("language"), language);
	}
});

test("interpolation preserves external text and handles missing messages safely", () => {
	setLanguage("it-it");
	const external = "{0} $& <script>_Nome_</script>";
	assert.equal(t `Successfully redeemed code: ${external}`, `Codice riscattato: ${external}`);
	assert.equal(t `An untranslated message: ${external}`, `An untranslated message: ${external}`);
	assert.equal(t("constructor"), "constructor");
	assert.equal(t("__proto__"), "__proto__");
	assert.equal(t("Loaded {0} configuration entries", 3), "Caricate 3 voci di configurazione");
});

test("language files are discovered by filename and preserve placeholders", () => {
	const placeholders = text => [...text.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
	const catalogFiles = fs.readdirSync(path.join(root, "localization"))
		.filter(file => file.toLowerCase().endsWith(".js") && file !== "index.js");
	for (const file of catalogFiles) {
		const catalog = require(path.join(root, "localization", file));
		assert.equal(catalog.language.toLowerCase(), file.slice(0, -3).toLowerCase());
		assert.equal(Intl.getCanonicalLocales(catalog.locale).length, 1);
		for (const [source, translated] of Object.entries(catalog.messages)) {
			assert.deepEqual(placeholders(translated), placeholders(source), `${file}: ${source}`);
			assert.ok(translated.length, `${file}: ${source}`);
		}
	}
	const files = [];
	function collect (dir) {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (["node_modules", ".git", ".codex-private", ".codex", ".agents", "tests", "localization"].includes(entry.name)) {
				continue;
			}
			const file = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				collect(file);
			}
			else if (file.endsWith(".js")) {
				files.push(file);
			}
		}
	}
	collect(root);
	function visit (node) {
		if (!node || typeof node !== "object") {
			return;
		}
		let source;
		if (node.type === "CallExpression" && node.callee.name === "t" && node.arguments[0]?.type === "StringLiteral") {
			source = node.arguments[0].value;
		}
		else if (node.type === "TaggedTemplateExpression" && node.tag.name === "t") {
			source = node.quasi.quasis.map((q, i) => q.value.cooked + (i < node.quasi.expressions.length ? `{${i}}` : "")).join("");
		}
		if (source !== undefined) {
			assert.ok(Object.hasOwn(italian.messages, source), `Missing Italian message: ${source}`);
		}
		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const child of value) {
					visit(child);
				}
			}
			else if (value && typeof value === "object") {
				visit(value);
			}
		}
	}
	for (const file of files) {
		visit(parseSync(fs.readFileSync(file, "utf8"), { configFile: false, babelrc: false }));
	}
	const cheerio = require("cheerio");
	const $ = cheerio.load(fs.readFileSync(path.join(root, "setup/config/index.html"), "utf8"));
	for (const element of $("[data-i18n]").toArray()) {
		assert.ok(Object.hasOwn(italian.messages, $(element).attr("data-i18n")), $(element).attr("data-i18n"));
	}
});

test("a catalog registration alone enables another language and regional variants", () => {
	registerCatalog({
		language: "fr",
		locale: "fr-FR",
		messages: { "Today's Reward": "Récompense du jour" }
	});
	setLanguage("fr-ca");
	assert.deepEqual(getCatalogCandidates(" FR_ca "), ["fr-ca", "fr"]);
	assert.equal(getLocale(), "fr-FR");
	assert.equal(t("Today's Reward"), "Récompense du jour");
	assert.equal(t("No description provided"), "No description provided");
});

test("duration and state display localize without changing machine states", () => {
	const Utils = require("../singleton/utils.js");
	const utils = new Utils();
	assert.equal(utils.formatTime(90061), "1 day, 1 hr, 1 min, 1 sec");
	assert.equal(formatStatus("Finished"), "Finished");
	setLanguage("it-it");
	assert.equal(utils.formatTime(90061), "1 giorno, 1 ora, 1 min, 1 sec");
	assert.equal(formatStatus("Finished"), "Terminato");
	assert.equal(formatStatus("Ongoing"), "In corso");
	assert.equal(formatStatus("constructor"), "constructor");
	assert.equal(formatStatus("NewState"), "NewState");
});

test("error catalog follows locale even when loaded before configuration", () => {
	const errorMessage = require("../hoyolab-modules/error-messages.js");
	const AppError = require("../object/error.js");
	assert.equal(errorMessage("genshin", -2001), "The code has expired");
	setLanguage("it-it");
	assert.equal(errorMessage("genshin", -2001), "Il codice è scaduto");
	assert.equal(errorMessage("genshin", 123456), undefined);
	assert.match(errorMessage("genshin", 1034), /captcha.*https:\/\/act.hoyolab.com/);
	assert.match(new AppError.HoyoLabRequest({ retcode: -2001 }).message, /Il codice è scaduto/);
});

test("Italian command definitions keep identifiers and Discord limits", async () => {
	setLanguage("it-it");
	const Command = require("../classes/command.js");
	globalThis.app = { HoyoLab: { getActiveAccounts: () => []} };
	for (const entry of fs.readdirSync(path.join(root, "commands"), { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		const definition = require(`../commands/${entry.name}/index.js`);
		const data = new Command(definition).getSlashCommandData().toJSON();
		assert.equal(data.name, definition.name);
		assert.ok(data.description.length <= 100, `${entry.name}: ${data.description}`);
		for (const option of data.options || []) {
			assert.ok(option.description.length <= 100, option.description);
		}
	}
});

test("test notifications use Italian while keeping custom text and Telegram escaping", async () => {
	const { sendManualTestNotification, sendPlatformTestNotification } = require("../singleton/test-notification.js");
	globalThis.app = { Logger: { info () {}, warn () {} }, Error: require("../object/error.js") };
	setLanguage("it-it");
	const sent = [];
	const platform = { name: "telegram", id: 2, send: async message => sent.push(message) };
	await sendPlatformTestNotification(platform);
	assert.match(sent[0], /Notifica di prova/);
	assert.match(sent[0], /avviato correttamente\\!/);
	await sendManualTestNotification(platform, { message: "Hello _world_!" });
	assert.match(sent[1], /Hello \\_world\\_\\!/);
	assert.match(sent[1], /Tipo di prova/);
});

test("Apps Script loads in any file order and uses the shared catalog", () => {
	for (const order of [
		["services/google-script/index.js", "localization/index.js", "localization/it.js"],
		["localization/it.js", "localization/index.js", "services/google-script/index.js"]
	]) {
		const context = vm.createContext({ console });
		for (const file of order) {
			vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
		}
		assert.equal(vm.runInContext("t('Already signed in today')", context), "Already signed in today");
		assert.equal(vm.runInContext("config.language = 'it-it'; t('Already signed in today')", context), "Check-in già effettuato oggi");
	}
});

test("check-in keeps API locale, headers and sign body independent from software fallback", async () => {
	const CheckIn = require("../hoyolab-modules/genshin/check-in.js");
	for (const language of [undefined, "it-it", "ja-jp"]) {
		await Config.load({ language });
		const requests = [];
		const logs = [];
		const instance = {
			name: "genshin",
			fullName: "Genshin Impact",
			accounts: [{ uid: "123", cookie: "test-cookie", nickname: "Status", region: "os_euro", level: 60 }],
			config: {
				ACT_ID: "test-act",
				url: { info: "/event/sol/info", home: "/event/sol/home", sign: "/event/sol/sign" },
				successMessage: "Congratulations, Traveler! You have successfully checked in today~",
				assets: {}
			}
		};
		globalThis.app = {
			Config,
			Logger: { info: (...args) => logs.push(args) },
			HoyoLab: { getRegion: () => "EU" },
			Got: async (profile, options) => {
				requests.push({ profile, options });
				const data = options.url.endsWith("info")
					? { total_sign_day: 0, today: "2026-09-13", is_sign: false }
					: { awards: [{ name: "Daily Activity", cnt: 20, icon: "test-icon" }]};
				return { statusCode: 200, body: { retcode: 0, data } };
			}
		};
		const [result] = await new CheckIn(instance).checkAndExecute();
		assert.equal(result.username, "Status");
		assert.equal(result.award.name, "Daily Activity");
		assert.equal(result.total, 1);
		assert.equal(result.result, language === "it-it"
			? "Congratulazioni, Viaggiatore! Hai effettuato il check-in di oggi~"
			: instance.config.successMessage);
		assert.equal(requests.length, 3);
		for (const [index, { profile, options }] of requests.entries()) {
			assert.equal(profile, "HoYoLab");
			assert.deepEqual(options, {
				url: ["/event/sol/info", "/event/sol/home", "/event/sol/sign"][index],
				...(index === 2 ? { method: "POST" } : {}),
				responseType: "json",
				searchParams: { lang: language || "en-us", act_id: "test-act" },
				headers: { Cookie: "test-cookie", "x-rpc-signgame": "hk4e" }
			});
		}
		assert.ok(logs.some(args => args[1].includes(language === "it-it" ? "Ricompensa di oggi" : "Today's Reward")));
	}
});

test("stamina reminders translate both platforms without translating account values", async () => {
	const Utils = require("../singleton/utils.js");
	const account = { uid: "123", nickname: "Stamina", region: "os_euro", platform: "genshin", stamina: { check: true, fired: false, persistent: false, threshold: 100 } };
	const sent = [];
	globalThis.app = {
		Utils: new Utils(),
		HoyoLab: {
			getActiveAccounts: () => [account],
			getActivePlatform: () => ["genshin"],
			getRegion: () => "EU",
			get: () => ({
				update () {},
				notes: async () => ({ success: true, data: { stamina: { currentStamina: 120, maxStamina: 200, recoveryTime: 3600 }, assets: { color: 0, game: "Genshin Impact" } } })
			})
		},
		Platform: {
			getForAccount: () => [
				{ name: "webhook", createUserMention: () => "", send: async message => sent.push(message) },
				{ name: "telegram", send: async message => sent.push(message) }
			],
			getEmbedPlatforms: platforms => platforms.filter(platform => platform.name !== "telegram")
		}
	};
	setLanguage("it-it");
	await require("../crons/stamina/index.js").code();
	assert.equal(sent[0].title, "Promemoria energia");
	assert.equal(sent[0].fields[1].name, "Nome utente");
	assert.equal(sent[0].fields[1].value, "Stamina");
	assert.match(sent[1], /Promemoria energia/);
	assert.match(sent[1], /123 Stamina/);
	assert.equal(account.stamina.fired, true);
});

test("Apps Script remains usable as a single English file", () => {
	const context = vm.createContext({ console });
	vm.runInContext(fs.readFileSync(path.join(root, "services/google-script/index.js"), "utf8"), context);
	assert.equal(vm.runInContext("t`No ${'Genshin'} accounts provided`", context), "No Genshin accounts provided");
});

test("setup language switches marked text safely without changing input values", async () => {
	const label = { dataset: { i18n: "Application and HoYoLAB language:" }, textContent: "" };
	const dynamicTitle = { dataset: {}, textContent: "" };
	const localeInput = { value: "it-it" };
	const cookieInput = { value: "Status <b>untouched</b>" };
	const runtime = { context: null };
	const requestedCatalogs = [];
	const document = {
		baseURI: "file:///setup/config/index.html",
		documentElement: {},
		getElementById: () => localeInput,
		querySelectorAll: () => [label, dynamicTitle],
		createElement: () => ({ remove () {} }),
		head: {
			appendChild: script => {
				requestedCatalogs.push(String(script.src));
				if (String(script.src).endsWith("/it.js")) {
					vm.runInContext(fs.readFileSync(path.join(root, "localization/it.js"), "utf8"), runtime.context);
					script.onload();
				}
				else if (String(script.src).endsWith("/iT-cH.js")) {
					runtime.context.HoyoLabI18n.registerCatalog({
						language: "it-ch",
						locale: "it-CH",
						messages: { "Application and HoYoLAB language:": "Italiano svizzero" }
					});
					script.onload();
				}
				else {
					script.onerror();
				}
			}
		}
	};
	const context = vm.createContext({ document, URL, HoyoLabCatalogFiles: { it: "it.js", "it-ch": "iT-cH.js" } });
	runtime.context = context;
	for (const file of ["localization/index.js", "setup/config/localization.js"]) {
		vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
	}
	context.setLocalizedText(dynamicTitle, "Genshin Impact accounts {0}", 2);
	await context.updateLanguage();
	assert.equal(label.textContent, "Lingua del software e di HoYoLAB:");
	assert.equal(dynamicTitle.textContent, "Account Genshin Impact 2");
	assert.ok(requestedCatalogs[0].endsWith("/it.js"));
	assert.equal(requestedCatalogs.length, 1);
	assert.ok(requestedCatalogs.some(url => url.endsWith("/it.js")));
	localeInput.value = "it-ch";
	await context.updateLanguage();
	assert.equal(label.textContent, "Italiano svizzero");
	assert.ok(requestedCatalogs.some(url => url.endsWith("/iT-cH.js")));
	const loadedCount = requestedCatalogs.length;
	await context.updateLanguage();
	assert.equal(requestedCatalogs.length, loadedCount);
	assert.equal(document.documentElement.lang, "it-CH");
	assert.equal(dynamicTitle.textContent, "Genshin Impact accounts 2");
	const requestsBeforeFallback = requestedCatalogs.length;
	localeInput.value = "it-at";
	await context.updateLanguage();
	assert.equal(label.textContent, "Lingua del software e di HoYoLAB:");
	assert.equal(document.documentElement.lang, "it-IT");
	localeInput.value = "ja-jp";
	await context.updateLanguage();
	assert.equal(document.documentElement.lang, "en-US");
	assert.equal(label.textContent, "Application and HoYoLAB language:");
	assert.equal(dynamicTitle.textContent, "Genshin Impact accounts 2");
	assert.equal(requestedCatalogs.length, requestsBeforeFallback);
	assert.equal(localeInput.value, "ja-jp");
	assert.equal(cookieInput.value, "Status <b>untouched</b>");
	context.setLocalizedText(dynamicTitle, "Loaded {0} configuration entries", "<img src=x>");
	assert.equal(dynamicTitle.textContent, "Loaded <img src=x> configuration entries");
	assert.equal(dynamicTitle.innerHTML, undefined);
});


test("regional catalogs take precedence over generic catalogs", async () => {
	registerCatalog({ language: "de", locale: "de-DE", messages: { "Today's Reward": "Generic" } });
	registerCatalog({ language: "de-CH", locale: "de-CH", messages: { "Today's Reward": "Regional" } });
	for (const language of ["de-ch", "de-CH", "DE-ch", "DE-CH", " DE_ch "]) {
		await Config.load({ language });
		assert.equal(t("Today's Reward"), "Regional");
		assert.equal(getLocale(), "de-CH");
		assert.equal(Config.get("language"), language);
		assert.equal(t("Missing message"), "Missing message");
	}
	setLanguage("de-at");
	assert.equal(t("Today's Reward"), "Generic");
	assert.equal(getLocale(), "de-DE");
	setLanguage("zz-zz");
	assert.equal(getLocale(), "en-US");
	assert.deepEqual(getCatalogCandidates("../../it"), []);
	assert.deepEqual(getCatalogCandidates("it"), ["it"]);
});


test("Node discovers regional catalog filenames regardless of case", () => {
	const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "hoyolab-localization-"));
	try {
		fs.copyFileSync(path.join(root, "localization/index.js"), path.join(directory, "index.js"));
		fs.writeFileSync(path.join(directory, "iT-cH.JS"),
			`module.exports = ${JSON.stringify({ language: "IT-ch", locale: "it-CH", messages: { Reward: "Regionale" } })};`);
		fs.writeFileSync(path.join(directory, "IT.js"),
			`module.exports = ${JSON.stringify({ language: "it", locale: "it-IT", messages: { Reward: "Generica" } })};`);
		const localization = require(path.join(directory, "index.js"));
		for (const language of ["it-ch", "IT-CH", "it-CH"]) {
			localization.setLanguage(language);
			assert.equal(localization.t("Reward"), "Regionale");
			assert.equal(localization.getLocale(), "it-CH");
		}
		localization.setLanguage("it-at");
		assert.equal(localization.t("Reward"), "Generica");
		localization.setLanguage("zz-zz");
		assert.equal(localization.t("Reward"), "Reward");
	}
	finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});


test("the setup index discovers only existing catalog files with Node filename precedence", () => {
	const { getCatalogFiles, generateIndex } = require("../scripts/generate-localization-index.js");
	assert.equal(fs.readFileSync(path.join(root, "setup/config/catalogs.js"), "utf8"),
		generateIndex(path.join(root, "localization")));
	const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "hoyolab-catalog-index-"));
	try {
		for (const file of ["index.js", "README.md", "IT.js", "it.js", "iT-cH.JS", "invalid-name.js"]) {
			fs.writeFileSync(path.join(directory, file), "");
		}
		fs.mkdirSync(path.join(directory, "fr.js"));
		assert.deepEqual(getCatalogFiles(directory), { "it-ch": "iT-cH.JS", it: "it.js" });
		fs.writeFileSync(path.join(directory, "FR.js"), "");
		assert.equal(getCatalogFiles(directory).fr, "FR.js");
		fs.unlinkSync(path.join(directory, "it.js"));
		assert.equal(getCatalogFiles(directory).it, "IT.js");
	}
	finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});

test("Star Rail diary cache stores source categories across language changes", async () => {
	const Diary = require("../hoyolab-modules/starrail/diary.js");
	let cached;
	let fetches = 0;
	globalThis.app = {
		Cache: { get: async () => cached, set: async ({ value }) => { cached = value; } }
	};
	const diary = new Diary({ name: "starrail", config: { assets: {} } });
	diary.fetchResultsForType = async () => {
		fetches++;
		return {
			currentMonthResults: [{ action: "universe_point", num: 100 }],
			lastMonthResults: [{ action: "universe_point", num: 50 }]
		};
	};
	setLanguage("it-it");
	const first = await diary.diary({ uid: "test" });
	assert.equal(first.data.currentMonth.jades.actionPercentages[0].category, "Simulated Universe");
	assert.equal(t(cached.currentMonth.jades.actionPercentages[0].category), "Universo simulato");
	setLanguage("en-us");
	const second = await diary.diary({ uid: "test" });
	assert.equal(t(second.data.currentMonth.jades.actionPercentages[0].category), "Simulated Universe");
	assert.equal(fetches, 2);
});

test("Gotify localizes validation and delivery failures while preserving notification values", async () => {
	const Gotify = require("../platforms/gotify.js");
	globalThis.app = { Error: require("../object/error.js"), Got: async () => ({ statusCode: 503 }) };
	setLanguage("it-it");
	const config = { id: 1, url: "https://example.com", token: "synthetic-token" };
	assert.throws(() => new Gotify({ ...config, token: "" }), /Nessun token/);
	assert.throws(() => new Gotify({ ...config, url: "invalid" }), /URL del server Gotify non valido/);
	const platform = new Gotify(config);
	assert.throws(() => platform.prepareMessage(""), /non devono essere vuoti/);
	assert.throws(() => platform.prepareMessage("Hello", { priority: 1.5 }), /numero intero/);
	const message = platform.prepareMessage({ title: "External title", description: "External text", fields: []});
	assert.equal(message.title, "External title");
	assert.equal(message.message, "External text");
	await assert.rejects(platform.send("Hello"), /Invio della notifica Gotify non riuscito/);
});

test("Gotify setup text is marked and translated", () => {
	const $ = require("cheerio").load(fs.readFileSync(path.join(root, "setup/config/index.html"), "utf8"));
	setLanguage("it-it");
	for (const element of $("#gotify-settings label, #gotify-settings .small-text").toArray()) {
		const source = $(element).attr("data-i18n");
		assert.ok(source);
		assert.notEqual(t(source), source);
	}
});


test("failed listed catalogs fall back safely and stale language loads cannot overwrite the form", async () => {
	const input = { value: "it-ch" };
	const label = { dataset: { i18n: "Today's Reward" }, textContent: "Today's Reward" };
	const pending = [];
	const document = {
		baseURI: "file:///setup/config/index.html",
		documentElement: {},
		getElementById: () => input,
		querySelectorAll: () => [label],
		createElement: () => ({ remove () {} }),
		head: { appendChild: script => pending.push(script) }
	};
	const context = vm.createContext({ document, URL, HoyoLabCatalogFiles: { it: "it.js", "it-ch": "it-ch.js" } });
	for (const file of ["localization/index.js", "setup/config/localization.js"]) {
		vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
	}
	const oldUpdate = context.updateLanguage();
	assert.ok(String(pending[0].src).endsWith("/it-ch.js"));
	pending[0].onerror();
	await Promise.resolve();
	assert.ok(String(pending[1].src).endsWith("/it.js"));
	input.value = "zh-hans-cn";
	await context.updateLanguage();
	assert.equal(pending.length, 2);
	assert.equal(document.documentElement.lang, "en-US");
	vm.runInContext(fs.readFileSync(path.join(root, "localization/it.js"), "utf8"), context);
	pending[1].onload();
	await oldUpdate;
	assert.equal(label.textContent, "Today's Reward");
	assert.equal(document.documentElement.lang, "en-US");
	input.value = "it-ch";
	await context.updateLanguage();
	assert.equal(label.textContent, "Ricompensa di oggi");
	assert.equal(pending.length, 2);
});
