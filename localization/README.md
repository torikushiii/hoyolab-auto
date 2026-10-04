# Software translations

`language` selects the software locale as well as the existing HoYoLAB API locale.
English is the built-in default. A configured locale first uses its exact catalog
(for example, `it-ch.js`), then its generic language catalog (`it.js`) if the exact
catalog is absent, then English if neither exists. Missing messages in the selected
catalog fall back to English. Locale matching
ignores case in both the configured language and catalog metadata: `it-CH`,
`IT-ch`, and `it-ch` all select `it-ch.js`. It also accepts underscores without
modifying the API setting. Both Node.js and the setup generator match actual
catalog filenames without regard to case, including `it-CH.js` and `IT-ch.js`. If multiple filenames differ only in
case, they prefer the lowercase name, then the first name in lexical order.
The setup generator uses a generated directory index and never probes absent files.

## Add a language

Each software language is defined by one catalog file. Copy `it.js` to the primary
language code, such as `fr.js`, and change its metadata. For a regional translation,
use a locale filename such as `it-ch.js`, with `language: "it-ch"` and
`locale: "it-CH"`:

```js
(function (root) {
	const catalog = {
		language: "fr",
		locale: "fr-FR",
		messages: {
			"Today's Reward": "Récompense du jour"
		}
	};
	if (typeof module === "object" && module.exports) {
		module.exports = catalog;
	}
	else {
		root.HoyoLabLocales = root.HoyoLabLocales ?? {};
		root.HoyoLabLocales[catalog.language] = catalog;
		root.HoyoLabI18n?.registerCatalog(catalog);
	}
})(globalThis);
```

Do not edit `index.js`, the setup generator, or application modules. Node.js loads
the catalog by filename. Run `npm run localization:index` after adding, removing,
or renaming a catalog to refresh `setup/config/catalogs.js`; include that generated
file with your change. The index is also refreshed automatically by `npm test` and
`npm run setup:linux` / `npm run setup:windows`. Directly opening the HTML page uses
the checked-in index. The setup generator loads only listed files when its language
field changes. Google Apps Script cannot load repository files dynamically, so copy
the shared formatter and the desired catalog into the Apps Script project once.

Use `t("An English message")` for static text or a tagged template:

```js
const { t } = require("../localization/index.js");
const message = t `Loaded ${count} configuration entries`;
```

The English source is the fallback message. Add the corresponding entry to each catalog,
using numbered placeholders, for example `Loaded {0} configuration entries`.
Translate complete messages, preserve every placeholder and platform markup, and
escape Telegram Markdown at the existing rendering boundary. Values interpolated
into a message are never translated automatically. Keep protocol identifiers,
cache states, configuration keys and matching strings unchanged; translate known
states and categories only when displaying them.

The configuration page shares this catalog. Mark text-only elements with
`data-i18n="English source"`; dynamic labels use `setLocalizedText`. Translation
uses `textContent`, never HTML, and leaves form values unchanged. Keep English
fallback text in the HTML. Public documentation remains in English.

Run `npm test` and `npm run lint` after changing messages. The tests discover every
language file automatically and check its metadata and placeholder parity. They also
check full Italian coverage, language fallback, notification rendering, command
metadata and API locale independence.
