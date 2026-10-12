import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'BulkPublish — Share to 15 Platforms',
    description:
      'Compose, schedule, and publish posts to 15 social media platforms from any page with BulkPublish.',
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
            gecko: { id: 'chrome@bulkpublish.com', strict_min_version: '115.0' },
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
