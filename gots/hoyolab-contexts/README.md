# HoYoLAB request contexts

These opt-in Got profiles inherit transport, retry, timeout and error logging from
`Global`. Unmigrated flows retain their legacy request defaults:

- `HoYoLab`: HSR/HI3 discovery, HSR Notes, HSR/ZZZ redemption (module and cron),
  Traveling Mimo, and shared cookie refresh.
- `HoyoClient`: HSR Diary. This is an embedded WebView identity, not native Android.

Their headers and existing DS generators remain in use; changing them requires
separate endpoint evidence and request-contract tests.

| Profile | Identity / locale headers |
| --- | --- |
| `HoYoLabDesktopWeb` | Desktop event browser; no RPC defaults |
| `HoYoLabAppWebView` | Android WebView; no RPC defaults |
| `HoYoLabGameRecordDesktopWeb` | Desktop Game Record; full locale in both RPC language headers |
| `HoYoLabGameRecordAppWebView` | App Game Record; full locale in both RPC language headers |
| `HoYoLabZZZGameRecordAppWebView` | ZZZ Game Record WebView; full locale in both RPC language headers, no client_type/env |
| `HoYoLabNative` | Android OkHttp foundation; no production caller or verified signing implementation |

Select the profile by the endpoint's client context, not its hostname. Supply
routes, query/body, cookies and endpoint-specific headers on each request. DS is
explicitly opt-in via request headers, including for native APIs and the WebView
bootstrap endpoints that require signing. No profile generates a signature;
the correct signing algorithm must be established for each migrated endpoint.

`language.js` reads the existing `language` preference with fallback `en-us`.
`getLanguage()` preserves the full locale; `getLanguageOnly()` extracts its primary
language for Genshin browser redemption (`it-it` → `it`). It does not validate
backend support for other locales. Neither helper changes configuration or adds
query/body fields automatically. Locale headers are resolved when profiles load,
matching the application's initialization model.

The new Android profiles share one app-version constant. Their generic user agent
and omitted device/fingerprint metadata still require endpoint compatibility
validation; these foundations alone do not establish a working live request.

Offline tests verify constructed requests and synthetic responses. Successful
official-client captures support the migrated Genshin contracts, but do not prove
that the headless client's reduced cookie/header set works live. ZZZ discovery and
Notes also have successful official WebView captures; both forward the complete
controller-normalized cookie, without an additional Notes whitelist. Minimum
authentication/metadata requirements and configured locales beyond the captured
`en-us` remain unverified live. Non-empty
historical Genshin Diary summaries and point-cost Hilichurl exchanges have only
synthetic regression coverage. Other-game check-in captures reached the missing
character error; success, already-signed behavior and post-sign state remain
unverified on real accounts. Native redemption signing remains deferred.
