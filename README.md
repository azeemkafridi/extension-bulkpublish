<p>
  <img src="https://img.shields.io/badge/BulkPublish-browser%20extension-FA8112?style=flat-square" alt="BulkPublish browser extension" />
  <img src="https://img.shields.io/badge/built%20with-WXT-67d55e?style=flat-square" alt="WXT" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT" />
</p>

# BulkPublish for your browser

Compose, schedule, and publish posts to 15 social media platforms from any page — the [BulkPublish](https://bulkpublish.com) composer as a cross-browser extension, built with [WXT](https://wxt.dev) (Chrome MV3, Firefox, and Chromium relatives from one codebase).

- **Popup composer** — caption prefilled from the page you're on (title, URL, selected text), channel picker with channel sets, per-platform caption overrides with live character limits, media, scheduling, and team approval.
- **Right-click sharing** — "Share via BulkPublish" on any page, selection, or image opens the composer prefilled with exactly that.
- **Grab page images** — pull images straight out of the current page into your post, no saving-then-uploading.
- **Costs and quotas up front** — the same pre-publish table as the app: X credit pricing (link posts cost more than plain ones), plan quota, media storage, and your X balance.
- **Team approval** — hold posts for approval, and approve/reject/retry/delete recent posts from the Recent tab.
- **Large media** — files over 100 MB upload in 10 MB parts direct to storage, with per-part progress and automatic abort on failure.

## Install

Not yet listed in the stores. Load it unpacked:

1. `npm install && npm run build`
2. Chrome: `chrome://extensions` → enable Developer mode → *Load unpacked* → pick `.output/chrome-mv3`.
3. Firefox: `npm run build:firefox`, then `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick any file in `.output/firefox-mv2`.

## Setup

1. In [BulkPublish](https://app.bulkpublish.com), open **[Developer](https://app.bulkpublish.com/developer)** and create an API key (`bp_…`).
2. Click the extension icon → **Settings** → paste the key → *Save & verify*.
3. Compose away. Your channel selection is remembered for the next post.

### API key security

The key is stored in the browser's **local extension storage** (`storage.local`) on this machine only — deliberately *not* `storage.sync`, so it never replicates through your browser account to other devices. Anyone with access to your browser profile can read extension storage, so treat the profile like you treat the key. *Disconnect* in Settings removes it.

## Link tracking

A three-way setting, not a checkbox, because the API distinguishes them: **Account default** omits `linkTrackingOverride` from the post entirely (your workspace setting applies), **On** forces short tracked links, **Off** forces plain links. An untouched setting is not the same as deliberately off.

## Character limits

| Platform | Limit |
|---|---|
| Snapchat | 160 |
| X | 280 |
| Bluesky | 300 |
| Threads / Mastodon / Pinterest | 500 |
| Google Business | 1,500 |
| Discord | 2,000 |
| Instagram / TikTok | 2,200 |
| LinkedIn | 3,000 |
| Telegram | 4,096 |
| YouTube | 5,000 |
| Tumblr | 32,768 |
| Reddit | 40,000 |
| Facebook | 63,206 |

Snapchat is the tightest of the set — its caption is only ever used for a Spotlight description, and stories take no caption at all.

The composer measures the caption *as it will be sent* — `%%title%%` / `%%link%%` expand to the current page's title and URL before counting.

## Permissions it asks for

- `storage` — the API key and your preferences.
- `contextMenus` — the right-click "Share via BulkPublish" entry.
- `activeTab` + `scripting` — read the page's title/URL/selection and collect its images, only when you invoke the extension. No content scripts run in the background, and there is no `<all_urls>` host access.
- `app.bulkpublish.com` — the API. `*.r2.cloudflarestorage.com` — where large-file upload parts go.

## Development

```bash
npm install          # also runs wxt prepare
npm run dev          # Chrome dev mode with HMR
npm run dev:firefox
npm test             # node:test over lib/ (pure logic, no browser)
npm run build && npm run zip            # store artifact (Chrome)
npm run build:firefox && npm run zip:firefox
```

Pure logic (API client, post-body assembly, cost math, multipart planning, prefill) lives in `lib/` with no browser globals so `node --test` covers it directly. UI is React in `entrypoints/popup/`, ported from the BulkPublish WordPress plugin; `assets/tokens.css` is shared with it verbatim.

## License

MIT
