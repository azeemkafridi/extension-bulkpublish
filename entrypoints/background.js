/**
 * Background service worker.
 *
 * API calls do NOT live here: extension pages (the popup) are CORS-exempt for
 * host_permissions origins, so the popup talks to app.bulkpublish.com (and the
 * presigned R2 part URLs) directly with the shared BulkPublishClient — and a
 * large upload dies with the SW's 30s idle timeout anyway, while the popup
 * stays alive as long as it is open. The background only owns what genuinely
 * needs it: the context menus and the click → popup handoff.
 */
import { pendingPrefillItem } from '@/lib/storage.js';

const MENU_ID = 'bulkpublish-share';

export default defineBackground( () => {
	browser.runtime.onInstalled.addListener( () => {
		browser.contextMenus.create( {
			id: MENU_ID,
			title: 'Share via BulkPublish',
			contexts: [ 'page', 'selection', 'image' ],
		} );
	} );

	browser.contextMenus.onClicked.addListener( async ( info, tab ) => {
		if ( info.menuItemId !== MENU_ID ) {
			return;
		}
		await pendingPrefillItem.setValue( {
			title: ( tab && tab.title ) || '',
			url: info.pageUrl || ( tab && tab.url ) || '',
			selectionText: info.selectionText || '',
			imageUrl: info.mediaType === 'image' ? info.srcUrl || '' : '',
			at: Date.now(),
		} );
		// Firefox MV2 still calls this browserAction.
		const action = browser.action || browser.browserAction;
		try {
			await action.openPopup();
		} catch ( e ) {
			// openPopup is user-gesture-bound and not available everywhere —
			// fall back to a small standalone window running the same page.
			await browser.windows.create( {
				type: 'popup',
				url: browser.runtime.getURL( '/popup.html' ),
				width: 420,
				height: 640,
			} );
		}
	} );
} );
