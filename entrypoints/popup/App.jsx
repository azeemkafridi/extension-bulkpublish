/**
 * Popup shell — loads the stored key + settings, resolves what to prefill
 * (context-menu payload wins over the plain "current page" prefill), and
 * renders the Compose / Recent / Settings tabs.
 */
import { useState, useEffect, useMemo } from 'react';
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
				const context = {
					title: pending.title,
					url: pending.url,
					selectionText: pending.selectionText,
				};
				setPageContext( context );
				const prefill = buildPrefill( { ...context, imageUrl: pending.imageUrl } );
				setState( {
					...EMPTY_STATE,
					channels: stored.lastChannelIds || [],
					caption: prefill.caption,
					pendingImageUrl: prefill.imageUrl,
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
				<nav className="bp-tabs">
					{ [
						[ 'compose', 'Compose' ],
						[ 'recent', 'Recent' ],
						[ 'settings', 'Settings' ],
					].map( ( [ id, label ] ) => (
						<button
							type="button"
							key={ id }
							className={ cx( 'bp-tab', tab === id && 'is-active' ) }
							onClick={ () => setTab( id ) }
						>
							{ label }
						</button>
					) ) }
				</nav>
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
