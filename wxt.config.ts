import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    // AMO rejects a "name" over 45 characters (Chrome allows 75). Keep this
    // under 45 so one name serves both stores — 36 today.
    name: 'Social Media Scheduler — BulkPublish',
    description:
      'Compose, schedule, and publish posts to 15+ social media platforms with BulkPublish.',
    permissions: ['storage', 'contextMenus', 'activeTab', 'scripting'],
    // The R2 host is where multipart-upload presigned part URLs point; without
    // it the popup's PUTs would be CORS-blocked.
    host_permissions: [
      'https://app.bulkpublish.com/*',
      'https://*.r2.cloudflarestorage.com/*',
    ],
    action: { default_title: 'Share via BulkPublish' },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'chrome@bulkpublish.com',
              strict_min_version: '115.0',
              // AMO requires this key on every new add-on. The composer sends
              // the page's title, URL, selected text and chosen image to
              // app.bulkpublish.com to build the post, so `none` would be a
              // false declaration even though the user initiates every send.
              // Nothing else leaves the browser: no telemetry, no analytics,
              // so `technicalAndInteraction` is deliberately not listed.
              data_collection_permissions: { required: ['websiteContent'] },
            },
          },
        }
      : {}),
    ...(browser === 'safari'
      ? {
          // The App Store packager refuses an upload whose manifest name
          // differs from the app's product name.
          name: 'BulkPublish for Safari',
          // Safari recolours a one-colour toolbar icon to match its own
          // buttons (#E7E7E7 on the dark toolbar), so a single black glyph
          // serves both appearances. The colour logo stays the app icon.
          action: {
            default_title: 'Share via BulkPublish',
            default_icon: {
              16: 'icon/toolbar/16.png',
              19: 'icon/toolbar/19.png',
              32: 'icon/toolbar/32.png',
              38: 'icon/toolbar/38.png',
            },
          },
        }
      : {}),
  }),
});
