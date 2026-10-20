/**
 * Popup shell — loads the stored key + settings, resolves what to prefill
 * (context-menu payload wins over the plain "current page" prefill), and
 * renders the Compose / Recent / Settings tabs.
 */
import { useState, useEffect, useMemo } from 'react';
import { BulkPublishClient } from '@/lib/api.js';
import { buildPrefill } from '@/lib/prefill.js';
import { composerStateFromPost } from '@/lib/post-state.js';
import {
	draftPageContext,
	isDraftFromAnotherPage,
	shouldRestore,
} from '@/lib/draft.js';
import {
	apiKeyItem,
	settingsItem,
	draftItem,
	pendingPrefillItem,
	publishingItem,
} from '@/lib/storage.js';
import { getPageContext } from './page.js';
import { Spinner, Menu, MenuItem } from './components/ui.jsx';
import { Composer } from './components/Composer.jsx';
import { RecentPosts } from './components/RecentPosts.jsx';
import { Settings } from './components/Settings.jsx';
import { StatusPreview } from './components/StatusPreview.jsx';

const TABS = [
	[ 'compose', 'Compose' ],
	[ 'recent', 'Recent' ],
	[ 'settings', 'Settings' ],
	...( import.meta.env.DEV ? [ [ 'status-preview', 'Status preview' ] ] : [] ),
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
	postFormat: 'post',
	postTypeOverrides: {},
	platformSpecific: {},
	threadParts: [ { content: '', mediaFileIds: [] }, { content: '', mediaFileIds: [] } ],
	firstComment: '',
	requestApproval: false,
	scheduleEnabled: false,
	scheduleAt: '',
	bpPostId: null,
	editingPostId: null,
	protectMedia: false,
	linkTracking: undefined,
};

const EMPTY_PAGE = { title: '', url: '', selectionText: '' };

export default function App() {
	const [ ready, setReady ] = useState( false );
	const [ apiKey, setApiKey ] = useState( '' );
	const [ settings, setSettings ] = useState( { linkTrackingDefault: 'default' } );
	const [ tab, setTab ] = useState( 'compose' );
	const [ state, setState ] = useState( EMPTY_STATE );
	const [ pageContext, setPageContext ] = useState( EMPTY_PAGE );
	const [ currentPageContext, setCurrentPageContext ] = useState( EMPTY_PAGE );
	const [ staleDraft, setStaleDraft ] = useState( false );
	const [ composerRevision, setComposerRevision ] = useState( 0 );
	useEffect( () => {
		( async () => {
			const [ key, stored, draft, pending, page, run ] = await Promise.all( [
				apiKeyItem.getValue(),
				settingsItem.getValue(),
				draftItem.getValue(),
				pendingPrefillItem.getValue(),
				getPageContext(),
				publishingItem.getValue(),
			] );
			setApiKey( key );
			setSettings( stored );
			if ( ! key ) {
				setTab( 'settings' );
			}

			if ( run ) {
				setCurrentPageContext( page );
				setPageContext( run.draft.pageContext || page );
				setState( { ...EMPTY_STATE, ...run.draft, bpPostId: run.postId, editingPostId: null } );
				if ( pending ) await pendingPrefillItem.removeValue();
			} else if ( pending ) {
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
				setCurrentPageContext( context );
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
				setCurrentPageContext( page );
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
				const restore = shouldRestore( draft, page.url );
				const fromAnotherPage = restore && isDraftFromAnotherPage( draft, page.url );
				setPageContext( fromAnotherPage ? draftPageContext( draft ) : page );
				setState( restore ? { ...EMPTY_STATE, ...draft } : fresh() );
				setStaleDraft( fromAnotherPage );
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
		// Publishing has a separate durable journal, restored before this draft.
			draftItem.setValue( {
			caption: state.caption,
			channels: state.channels,
			perChannel: state.perChannel,
			mediaIds: state.mediaIds,
			mediaItems: state.mediaItems,
			postFormat: state.postFormat,
			postTypeOverrides: state.postTypeOverrides,
			platformSpecific: state.platformSpecific,
			threadParts: state.threadParts,
			firstComment: state.firstComment,
			requestApproval: state.requestApproval,
			scheduleEnabled: state.scheduleEnabled,
			scheduleAt: state.scheduleAt,
			pageCardDismissed: state.pageCardDismissed,
			// Baseline for isUntouchedPrefill on the next open.
			prefillCaption: state.prefillCaption,
			pageUrl: state.pageUrl,
			// Keep the OG/title/image snapshot attached to the draft it describes;
			// the active tab may be a completely different page next time.
			pageContext,
			// Kept so a reopened draft still knows its media belongs to a
			// created post and must not be deleted on detach.
			bpPostId: state.bpPostId,
			editingPostId: state.editingPostId,
			protectMedia: state.protectMedia,
			linkTracking: state.linkTracking,
		} );
		if ( ( state.channels || [] ).length ) {
			settingsItem.setValue( { ...settings, lastChannelIds: state.channels } );
		}
	}, [ ready, state, pageContext ] );

	const client = useMemo(
		() => ( apiKey ? new BulkPublishClient( { apiKey } ) : null ),
		[ apiKey ]
	);

	const startFreshFromPage = async () => {
		const endedRun = await publishingItem.getValue().catch( () => null );
		await publishingItem.removeValue();
		// Media uploaded by an abandoned, not-yet-created post is safe to reclaim.
		// Once bpPostId exists, the server post may still reference it. So may a
		// submission whose outcome was never confirmed (the response was lost):
		// the post can exist with no id on our side, and deleting its files left
		// a live or scheduled post pointing at nothing.
		const outcomeUnknown = !! endedRun && [ 'uncertain', 'submitting' ].includes( endedRun.phase );
		if ( client && ! state.bpPostId && ! state.protectMedia && ! outcomeUnknown ) {
			const mediaIds = [ ...new Set( [
				...( state.mediaIds || [] ),
				...( state.threadParts || [] ).flatMap( ( part ) => part.mediaFileIds || [] ),
			] ) ];
			Promise.all(
				mediaIds.map( ( id ) =>
					client.deleteMedia( id ).catch( () => {} )
				)
			).catch( () => {} );
		}
		await draftItem.removeValue();
		const prefill = buildPrefill( currentPageContext );
		setPageContext( currentPageContext );
		setState( {
			...EMPTY_STATE,
			channels: ( state.channels && state.channels.length
				? state.channels
				: settings.lastChannelIds ) || [],
			caption: prefill.caption,
			prefillCaption: prefill.caption,
			pageUrl: currentPageContext.url,
		} );
		setStaleDraft( false );
		setComposerRevision( ( value ) => value + 1 );
		setTab( 'compose' );
	};

	const openRecentPost = ( post, duplicate = false ) => {
		setPageContext( EMPTY_PAGE );
		setState( { ...EMPTY_STATE, ...composerStateFromPost( post, { duplicate } ) } );
		setStaleDraft( false );
		setComposerRevision( ( value ) => value + 1 );
		setTab( 'compose' );
	};

	if ( ! ready ) {
		return <Spinner label="Loading…" />;
	}

	return (
		<div className="bp-app">
			<header className="bp-app-head">
				<button
					type="button"
					className="bp-app-home"
					onClick={ () => setTab( 'compose' ) }
					aria-label="Go to Compose"
					title="Compose"
				>
					<img src="/icon/48.png" alt="" width="20" height="20" />
					<span className="bp-app-title">BulkPublish</span>
				</button>
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
							key={ composerRevision }
							client={ client }
							state={ state }
							setState={ setState }
							pageContext={ pageContext }
							settings={ settings }
							staleDraft={ staleDraft }
							onStartFresh={ startFreshFromPage }
						/>
					) : (
						<p className="bp-muted">
							Add your API key in Settings to start composing.
						</p>
					) ) }
				{ tab === 'recent' &&
					( client ? (
						<RecentPosts
							client={ client }
							onEdit={ ( post ) => openRecentPost( post, false ) }
							onDuplicate={ ( post ) => openRecentPost( post, true ) }
						/>
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
							setStaleDraft( false );
							setComposerRevision( ( value ) => value + 1 );
						} }
					/>
				) }
				{ import.meta.env.DEV && tab === 'status-preview' && <StatusPreview /> }
			</main>
		</div>
	);
}
