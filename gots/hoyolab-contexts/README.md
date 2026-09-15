# HoYoLAB request contexts

These opt-in Got profiles inherit transport, retry, timeout and error logging from
`Global`. Existing callers continue to use the unchanged `HoYoLab` and `HoyoClient`
profiles until each flow is migrated.

| Profile | Identity / locale headers |
| --- | --- |
| `HoYoLabDesktopWeb` | Desktop event browser; no RPC defaults |
| `HoYoLabAppWebView` | Android WebView; no RPC defaults |
| `HoYoLabGameRecordDesktopWeb` | Desktop Game Record; full locale in both RPC language headers |
| `HoYoLabGameRecordAppWebView` | App Game Record; full locale in both RPC language headers |
| `HoYoLabNative` | Android OkHttp; full locale in `x-rpc-language` |

Select the profile by the endpoint's client context, not its hostname. Supply
routes, query/body, cookies and endpoint-specific headers on each request. DS is
explicitly opt-in via request headers, including for native APIs and the WebView
bootstrap endpoints that require signing. No profile generates a signature;
the correct signing algorithm must be established for each migrated endpoint.

`language.js` reads the existing `language` preference with fallback `en-us`.
`getLanguage()` preserves the full locale; `getLanguageOnly()` extracts its primary
language for APIs such as native redemption (`it-it` → `it`). It does not validate
backend support for other locales. Neither helper changes configuration or adds
query/body fields automatically. Locale headers are resolved when profiles load,
matching the application's initialization model.

The new Android profiles share one app-version constant. Their generic user agent
and omitted device/fingerprint metadata still require endpoint compatibility
validation; these foundations alone do not establish a working live request.
