/**
 * Background service worker.
 *
 * Owns submission and its durable journal so closing the popup does not
 * abandon a create/publish sequence. Media uploads still run in the popup.
 */
import { pendingPrefillItem, publishingItem, apiKeyItem } from '@/lib/storage.js';
import { BulkPublishClient, errorMessage } from '@/lib/api.js';

const MENU_ID = 'bulkpublish-share';

export default defineBackground( () => {
	let submitting = false;
	browser.runtime.onMessage.addListener( ( message, sender, respond ) => {
		if ( message?.type !== 'bulkpublish-submit' || sender.id !== browser.runtime.id ) return;
		if ( submitting ) { respond( { error: 'A publication is already in progress.' } ); return; }
		submitting = true;
		( async () => {
			let run;
			let wrote = false;
			try {
				if ( await publishingItem.getValue() ) throw new Error( 'Review the previous publication before starting another.' );
				const key = await apiKeyItem.getValue();
				if ( ! key ) throw new Error( 'Connect BulkPublish before publishing.' );
				run = { draft: message.draft, startedAt: Date.now(), phase: 'submitting', post: null, postId: message.editingPostId || null };
				await publishingItem.setValue( run );
				const client = new BulkPublishClient( { apiKey: key } );
				const options = { ...message.options, onCreated: async ( post ) => {
					wrote = true;
					run = { ...run, postId: post.id, post };
					await publishingItem.setValue( run );
				} };
				const post = message.editingPostId
					? await client.updateAndMaybePublish( message.editingPostId, message.body, options )
					: await client.createAndMaybePublish( message.body, options );
				await publishingItem.setValue( { ...run, phase: 'submitted', postId: post.id, post } );
				respond( { post } );
			} catch ( error ) {
				// A definite refusal (4xx) before anything was written changed
				// nothing on the server: drop the run so the composer stays
				// editable and shows the reason. Recording it as "uncertain" locked
				// the composer, and its only exit (Done) discarded the draft and
				// deleted the uploaded media — for a quota 429 or one bad field.
				// Network drops, 5xx and anything after a write stay uncertain.
				const refused = ! wrote && ! error?.bpPostId && error?.status >= 400 && error?.status < 500;
				if ( run && refused ) await publishingItem.removeValue();
				else if ( run ) await publishingItem.setValue( { ...run, phase: 'uncertain', error: errorMessage( error ), requestId: error.requestId, errorCode: error.code } );
				respond( { error: errorMessage( error ), code: error?.code, bpPostId: error?.bpPostId } );
			} finally { submitting = false; }
		} )();
		return true;
	} );
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
