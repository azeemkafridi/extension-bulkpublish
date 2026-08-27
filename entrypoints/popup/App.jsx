/**
 * Popup shell — loads the stored key + settings, resolves what to prefill
 * (context-menu payload wins over the plain "current page" prefill), and
 * renders the Compose / Recent / Settings tabs.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { BulkPublishClient } from '@/lib/api.js';
import { buildPrefill } from '@/lib/prefill.js';
import {
	apiKeyItem,
	settingsItem,
	draftItem,
	pendingPrefillItem,
} from '@/lib/storage.js';
import { getPageContext } from './page.js';
import { cx, Spinner } from './components/ui.jsx';
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
	const [ menuOpen, setMenuOpen ] = useState( false );
	const menuRef = useRef( null );

	// Close the section menu on outside click / Escape, same as the channel popover.
	useEffect( () => {
		if ( ! menuOpen ) {
			return;
		}
		const onDown = ( e ) => {
			if ( menuRef.current && ! menuRef.current.contains( e.target ) ) {
				setMenuOpen( false );
			}
		};
		const onKey = ( e ) => {
			if ( e.key === 'Escape' ) {
				setMenuOpen( false );
			}
		};
		document.addEventListener( 'mousedown', onDown );
		document.addEventListener( 'keydown', onKey );
		return () => {
			document.removeEventListener( 'mousedown', onDown );
			document.removeEventListener( 'keydown', onKey );
		};
	}, [ menuOpen ] );

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
				} );
			} else {
				setPageContext( page );
				if ( draft && ( draft.caption || ( draft.mediaIds || [] ).length ) ) {
					setState( { ...EMPTY_STATE, ...draft } );
				} else {
					const prefill = buildPrefill( page );
					setState( {
						...EMPTY_STATE,
						channels: stored.lastChannelIds || [],
						caption: prefill.caption,
					} );
				}
			}
			setReady( true );
		} )();
	}, [] );

	// Autosave the composer so an accidental dismiss loses nothing; remember
	// the channel selection as the next post's default.
	useEffect( () => {
		if ( ! ready ) {
			return;
		}
		draftItem.setValue( {
			caption: state.caption,
			channels: state.channels,
			perChannel: state.perChannel,
			mediaIds: state.mediaIds,
			mediaItems: {},
			requestApproval: state.requestApproval,
			scheduleEnabled: state.scheduleEnabled,
			scheduleAt: state.scheduleAt,
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
				<div className="bp-menu" ref={ menuRef }>
					<button
						type="button"
						className="bp-iconbtn"
						onClick={ () => setMenuOpen( ! menuOpen ) }
						aria-haspopup="menu"
						aria-expanded={ menuOpen }
						aria-label="Menu"
						title="Menu"
					>
						<IconMenu />
					</button>
					{ menuOpen && (
						<div className="bp-menu-pop" role="menu">
							{ TABS.map( ( [ id, label ] ) => (
								<button
									type="button"
									key={ id }
									role="menuitem"
									className={ cx(
										'bp-menu-item',
										tab === id && 'is-active'
									) }
									onClick={ () => {
										setTab( id );
										setMenuOpen( false );
									} }
								>
									<span>{ label }</span>
									{ tab === id && <IconCheck /> }
								</button>
							) ) }
						</div>
					) }
				</div>
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
