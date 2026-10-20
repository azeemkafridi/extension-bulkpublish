# Safari (Mac App Store) wrapper

The Xcode project here wraps the WXT Safari build. It references
`../.output/safari-mv3` rather than copying it, so always rebuild first:

```bash
npx wxt build -b safari --mv3     # MV3 — WXT defaults Safari to MV2
open "safari/BulkPublish for Safari/BulkPublish for Safari.xcodeproj"
```

Then Product › Archive, and Distribute App › App Store Connect.

Fixed identity — never change these, or the store treats it as a new app:

| | |
|---|---|
| App bundle id | `com.bulkpublish.safari` |
| Extension bundle id | `com.bulkpublish.safari.Extension` |
| Team | `K49DULAR4B` |
| Minimum macOS | 13.0 |

Bump `CURRENT_PROJECT_VERSION` on every upload (and `MARKETING_VERSION` with
`package.json` on a release).

## App Review rules this build depends on

- **3.1.1 / 3.1.3(f)** — the Safari build must show no prices, credit balances
  or "upgrade" prompts. `lib/store-copy.js` strips purchase sentences from every
  server message, and `CostTable` drops its price column under `IS_SAFARI`.
  New UI that can show plan or price text must go through `storeSafe`.
- **2.1** — the host app's button must never be a dead end. When Safari has not
  registered the extension yet, `showPreferencesForExtension` errors
  (`SFErrorDomain` 1) or never calls back; `ViewController` then opens Safari
  itself after 3 s and shows manual steps. Build 4 was rejected for this.
- **5.2.5** — no "Safari" in the App Store subtitle or keywords, and no Safari
  imagery in screenshots. The product name "BulkPublish for Safari" is
  required to match the manifest name (see `wxt.config.ts`).
- Review notes must include a demo account on a paid plan plus an API key: the
  Free plan's 30 API requests a day run out within minutes of status polling.
