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
  }),
});
