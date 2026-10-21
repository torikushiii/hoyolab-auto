# HoYoLAB request contexts

These Got profiles inherit transport, retry, timeout and error logging from
`Global`. Select an identity for the operation, supplying its route, query/body,
cookie and endpoint-specific headers explicitly.

| Profile | Identity / locale headers |
| --- | --- |
| `HoYoLabDesktopWeb` | Desktop event browser; no RPC defaults |
| `HoYoLabAppWebView` | Android WebView; no RPC defaults |
| `HoYoLabGameRecordDesktopWeb` | Genshin desktop Game Record; full RPC language and lang |
| `HoYoLabGameRecordAppWebView` | Genshin app Game Record; full RPC language and lang |
| `HoYoLabZZZGameRecordAppWebView` | ZZZ Game Record; full RPC language and lang; no client_type/env |
| `HoYoLabHSRGameRecordDesktopWeb` | HSR desktop Game Record; client 5, app 1.5.0, platform 4, full RPC language |
| `HoYoLabHI3GameRecordDesktopWeb` | HI3 desktop Game Record; client 5, app 1.5.0, full RPC language; no platform |
| `HoYoLabPassport` | Dedicated Passport SDK metadata; full configured language |

`language.js` preserves the configured preference with fallback `en-us`.
`getLanguageOnly()` extracts the primary language for browser redemption. Neither
helper changes configuration or assumes backend support for arbitrary locales.
Software localization fallback never changes the request locale.

Mimo HSR/ZZZ index and task operations use AppWebView; shop, purchase history and
lottery use DesktopWeb. POST operations send the full locale in both query and
JSON. No DS, Game Record RPC, invented device identity or age state is inherited.
The existing task whitelist, lottery opt-in, shop policies, reserves, retry delays
and redemption preferences remain in effect. Qiuqiu uses separate underscore
routes and omits locale from POST JSON. Its two internal lottery methods retain
local legacy defaults because their contract is unverified; supported cron and
command flows do not activate Genshin lottery. The global `HoYoLab` and
`HoyoClient` registrations have been removed.

Hilichurl retains upstream automatic completion for types 1/2/4/10/101/102.
Timed types 101/102 wait for a positive `read_seconds` plus one second, then use
DesktopWeb with community Origin/Referer, client 4, app version and configured
RPC language, without DS or a query locale. Other completions and reward claims
retain the event WebView contract. The wait and synthetic request/response tests
do not establish that the backend accepts the headless timed flow.

Passport refresh uses the existing SG fallback, `stoken`/`mid` cookie and token
lifecycle. Its dedicated signer hashes the exact serialized JSON body with an
empty signed query. SDK/app constants and the configured language are sent;
Android device/fingerprint, regional routing state, age and challenge metadata
are omitted because the application has no legitimate values for them. This
reduced headless identity has not been validated against the backend.
Passport signing is separate from desktop basic DS, which
remains explicitly used by HSR/HI3 Game Record.

Genshin/HSR Diary read the nested `month_data` summaries without DS. HSR checks `data_month`
against the requested month. HSR/ZZZ browser redemption uses POST risk endpoints
and requires the configured cookie's `_MHYUUID`, preserved across cookie refresh.
Check-in descriptors keep per-game query/body differences; Genshin, HSR, ZZZ and
HI3 verify post-claim status.

The standalone [Google Apps Script](../../services/google-script/README.md)
uses the same per-game discovery, check-in and browser redemption contracts
through `UrlFetchApp`. Its own HTTP tests stub Google services; they do not
validate the deployed Google transport or backend acceptance.

Offline tests exercise effective URLs, serialized bodies, headers, signing,
locale/setup compatibility and synthetic response lifecycles without account
credentials or network access. Official-client observations support the selected
request contracts, including HSR point-cost exchange and downstream redemption.
They do not establish that the bot's reduced headers/cookies work live. ZZZ Mimo
shop/lottery success, lottery prizes containing codes, the precise ToT WebView
claim subset, and Passport's minimum backend metadata remain unverified. Synthetic
fixtures for these cases are regression coverage, not successful API calls.
