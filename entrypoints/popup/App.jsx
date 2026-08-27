/**
 * Popup shell — loads the stored key + settings, resolves what to prefill
 * (context-menu payload wins over the plain "current page" prefill), and
 * renders the Compose / Recent / Settings tabs.
 */
import { useState, useEffect, useMemo } from 'react';
import { BulkPublishClient } from '@/lib/api.js';
import { buildPrefill } from '@/lib/prefill.js';
import { shouldRestore } from '@/lib/draft.js';
import {
	apiKeyItem,
	settingsItem,
	draftItem,
	pendingPrefillItem,
} from '@/lib/storage.js';
import { getPageContext } from './page.js';
import { Spinner, Menu, MenuItem } from './components/ui.jsx';
import { Composer } from './components/Composer.jsx';
import { RecentPosts } from './components/RecentPosts.jsx';
import { Settings } from './components/Settings.jsx';

const TABS = [
	[ 'compose', 'Compose' ],
	[ 'recent', 'Recent' ],
	[ 'settings', 'Settings' ],
];

const IconMenu = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<path d="M3 6h18M3 12h18M3 18h18" />
	</svg>
);

const IconCheck = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
		<path d="M20 6L9 17l-5-5" />
	</svg>
);

const EMPTY_STATE = {
	caption: '',
	channels: [],
	perChannel: {},
	mediaIds: [],
	mediaItems: {},
	requestApproval: false,
	scheduleEnabled: false,
	scheduleAt: '',
	bpPostId: null,
};

export default function App() {
	const [ ready, setReady ] = useState( false );
	const [ apiKey, setApiKey ] = useState( '' );
	const [ settings, setSettings ] = useState( { linkTrackingDefault: 'default' } );
	const [ tab, setTab ] = useState( 'compose' );
	const [ state, setState ] = useState( EMPTY_STATE );
	const [ pageContext, setPageContext ] = useState( { title: '', url: '', selectionText: '' } );
	useEffect( () => {
		( async () => {
			const [ key, stored, draft, pending, page ] = await Promise.all( [
				apiKeyItem.getValue(),
				settingsItem.getValue(),
				draftItem.getValue(),
				pendingPrefillItem.getValue(),
				getPageContext(),
			] );
			setApiKey( key );
			setSettings( stored );
			if ( ! key ) {
				setTab( 'settings' );
			}

			if ( pending ) {
				// Context-menu payload: consume it once, and prefer its page
				// (the tab that was right-clicked) over whatever is active now.
				await pendingPrefillItem.removeValue();
				// Keep the live page's metadata only when it describes the same
				// page — otherwise the card would show one page's image and
				// summary above another page's title and link.
				const samePage =
					pending.url &&
					( pending.url === page.tabUrl || pending.url === page.url );
				const context = {
					...( samePage ? page : {} ),
					title: pending.title || ( samePage ? page.title : '' ),
					url: pending.url,
					selectionText: pending.selectionText,
					// Right-clicking an image is a statement about which image
					// you want, so it outranks the page's og:image on the card.
					...( pending.imageUrl ? { image: pending.imageUrl } : {} ),
				};
				setPageContext( context );
				const prefill = buildPrefill( context );
				setState( {
					...EMPTY_STATE,
					channels: stored.lastChannelIds || [],
					caption: prefill.caption,
					prefillCaption: prefill.caption,
					pageUrl: context.url,
				} );
			} else {
				setPageContext( page );
				const prefill = buildPrefill( page );
				const fresh = () => ( {
					...EMPTY_STATE,
					// Channels are a standing preference, so they carry over
					// even when the draft itself doesn't.
					channels: ( draft && draft.channels && draft.channels.length
						? draft.channels
						: stored.lastChannelIds ) || [],
					caption: prefill.caption,
					prefillCaption: prefill.caption,
					pageUrl: page.url,
				} );
				setState(
					shouldRestore( draft, page.url )
						? { ...EMPTY_STATE, ...draft }
						: fresh()
				);
			}
			setReady( true );
		} )();
	}, [] );

	// Autosave the composer. A popup is dismissed by any click outside it, so
	// this is the normal way a session ends, not an edge case — every field
	// that took the user effort has to survive it, media included. The items
	// map carries durable upload URLs (not blob: handles), so thumbnails come
	// back too.
	useEffect( () => {
		if ( ! ready ) {
			return;
		}
		// Once a post has gone out, its draft has served its purpose — keeping
		// it would greet the next popup with an already-published caption and
		// invite sending it twice. The in-session view keeps showing status.
		if ( state.published ) {
			draftItem.removeValue();
			return;
		}
		draftItem.setValue( {
			caption: state.caption,
			channels: state.channels,
			perChannel: state.perChannel,
			mediaIds: state.mediaIds,
			mediaItems: state.mediaItems,
			requestApproval: state.requestApproval,
			scheduleEnabled: state.scheduleEnabled,
			scheduleAt: state.scheduleAt,
			pageCardDismissed: state.pageCardDismissed,
			// Baseline for isUntouchedPrefill on the next open.
			prefillCaption: state.prefillCaption,
			pageUrl: state.pageUrl,
			// Kept so a reopened draft still knows its media belongs to a
			// created post and must not be deleted on detach.
			bpPostId: state.bpPostId,
		} );
		if ( ( state.channels || [] ).length ) {
			settingsItem.setValue( { ...settings, lastChannelIds: state.channels } );
		}
	}, [ ready, state ] );

	const client = useMemo(
		() => ( apiKey ? new BulkPublishClient( { apiKey } ) : null ),
		[ apiKey ]
	);

	if ( ! ready ) {
		return <Spinner label="Loading…" />;
	}

	return (
		<div className="bp-app">
			<header className="bp-app-head">
				<img src="/icon/48.png" alt="" width="20" height="20" />
				<span className="bp-app-title">BulkPublish</span>
				{ /* The tabs moved into this menu, so the section name has to be
				     stated here — otherwise nothing on screen says where you are. */ }
				<span className="bp-app-section">
					{ ( TABS.find( ( [ id ] ) => id === tab ) || [] )[ 1 ] }
				</span>
				<Menu icon={ <IconMenu /> } label="Menu">
					{ TABS.map( ( [ id, label ] ) => (
						<MenuItem
							key={ id }
							active={ tab === id }
							onClick={ () => setTab( id ) }
							after={ tab === id ? <IconCheck /> : null }
						>
							{ label }
						</MenuItem>
					) ) }
				</Menu>
			</header>
			<main className="bp-app-body">
				{ tab === 'compose' &&
					( client ? (
						<Composer
							client={ client }
							state={ state }
							setState={ setState }
							pageContext={ pageContext }
							settings={ settings }
						/>
					) : (
						<p className="bp-muted">
							Add your API key in Settings to start composing.
						</p>
					) ) }
				{ tab === 'recent' &&
					( client ? (
						<RecentPosts client={ client } />
					) : (
						<p className="bp-muted">
							Add your API key in Settings to see your posts.
						</p>
					) ) }
				{ tab === 'settings' && (
					<Settings
						hasKey={ !! apiKey }
						settings={ settings }
						onSettingsChange={ async ( next ) => {
							setSettings( next );
							await settingsItem.setValue( next );
						} }
						testKey={ ( key ) =>
							new BulkPublishClient( { apiKey: key } ).getChannels()
						}
						onSaveKey={ async ( key ) => {
							await apiKeyItem.setValue( key );
							setApiKey( key );
						} }
						onDisconnect={ async () => {
							await apiKeyItem.removeValue();
							await draftItem.removeValue();
							setApiKey( '' );
							setState( EMPTY_STATE );
						} }
					/>
				) }
			</main>
		</div>
	);
}
