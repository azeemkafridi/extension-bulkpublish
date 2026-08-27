/**
 * The composer — ported from the WP plugin's Composer.js, minus the
 * editor-only features (post meta, autoshare, featured image, server tokens).
 * Caption prefills from the current page (or the context-menu target);
 * %%title%% / %%link%% expand against that page at submit time.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PLATFORM_LIMITS, platformLabel } from '@/lib/constants.js';
import { errorMessage, isApprovalRequired } from '@/lib/api.js';
import { buildPostBody, hasLink as detectLink, overLimits as checkLimits } from '@/lib/compose.js';
import { resolveTokens } from '@/lib/prefill.js';
import { Button, Textarea, Toggle, Notice, Spinner, cx } from './ui.jsx';
import { ChannelSelector } from './ChannelSelector.jsx';
import { MediaField } from './MediaField.jsx';
import { StatusList } from './StatusList.jsx';
import { CostTable } from './CostTable.jsx';
import { CaptionTokens, insertToken, insertAtCaret } from './CaptionTokens.jsx';
import { PagePreview } from './PagePreview.jsx';
import { fetchPageImage, b64ToBlob } from '../page.js';
import { uploadBlob, extForMime } from '../upload.js';

const browserTz = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch ( e ) {
		return 'UTC';
	}
};

export function Composer( { client, state, setState, pageContext, settings } ) {
	const [ channels, setChannels ] = useState( null );
	const [ channelSets, setChannelSets ] = useState( [] );
	const [ loadErr, setLoadErr ] = useState( '' );
	const [ submitting, setSubmitting ] = useState( false );
	const [ submitErr, setSubmitErr ] = useState( '' );
	// { scheduled: bool, approvalStatus: string }
	const [ done, setDone ] = useState( null );
	const [ approvalBlocked, setApprovalBlocked ] = useState( false );
	const captionRef = useRef( null );

	useEffect( () => {
		let alive = true;
		client
			.getChannels()
			.then( ( r ) => alive && setChannels( r.channels || [] ) )
			.catch( ( e ) => alive && setLoadErr( errorMessage( e ) ) );
		// Channel sets are a convenience — ignore errors so a transport hiccup
		// never blocks the composer.
		client
			.getChannelSets()
			.then( ( r ) => alive && setChannelSets( Array.isArray( r ) ? r : [] ) )
			.catch( () => {} );
		return () => {
			alive = false;
		};
	}, [ client ] );

	const set = ( patch ) => setState( { ...state, ...patch } );

	const tokenValues = useMemo(
		() => ( { title: pageContext.title, url: pageContext.url } ),
		[ pageContext.title, pageContext.url ]
	);

	const caption = state.caption || '';
	// Everything downstream — limits, link pricing — must measure the caption
	// as it will actually be sent, not the template.
	const resolvedCaption = useMemo(
		() => resolveTokens( caption, tokenValues ),
		[ caption, tokenValues ]
	);
	const resolvedPerChannel = useMemo( () => {
		const out = {};
		Object.entries( state.perChannel || {} ).forEach( ( [ p, t ] ) => {
			out[ p ] = resolveTokens( t || '', tokenValues );
		} );
		return out;
	}, [ state.perChannel, tokenValues ] );

	const selectedPlatforms = useMemo( () => {
		const seen = {};
		( channels || [] ).forEach( ( c ) => {
			if ( ( state.channels || [] ).includes( c.id ) ) {
				seen[ c.platform ] = true;
			}
		} );
		return Object.keys( seen );
	}, [ channels, state.channels ] );

	const overLimits = useMemo(
		() =>
			checkLimits( {
				platforms: selectedPlatforms,
				content: resolvedCaption,
				perPlatform: resolvedPerChannel,
				limits: PLATFORM_LIMITS,
			} ),
		[ selectedPlatforms, resolvedCaption, resolvedPerChannel ]
	);

	const hasLink = useMemo(
		() => detectLink( resolvedCaption, resolvedPerChannel ),
		[ resolvedCaption, resolvedPerChannel ]
	);

	const minLimit = useMemo( () => {
		const limits = selectedPlatforms
			.map( ( p ) => PLATFORM_LIMITS[ p ] )
			.filter( Boolean );
		return limits.length ? Math.min( ...limits ) : null;
	}, [ selectedPlatforms ] );

	const hasContent =
		resolvedCaption.trim().length > 0 || ( state.mediaIds || [] ).length > 0;
	const canSubmit =
		( state.channels || [] ).length > 0 &&
		hasContent &&
		overLimits.length === 0 &&
		! submitting;

	/**
	 * Attach the page's social image. The fetch happens inside the page (which
	 * can read its own CDN's images where the extension origin is refused),
	 * then the bytes go straight to BulkPublish.
	 */
	const attachPageImage = async ( src ) => {
		const got = await fetchPageImage( src );
		if ( ! got ) {
			throw new Error(
				"Couldn't read that image from the page. Add it from Media instead."
			);
		}
		const blob = b64ToBlob( got.b64, got.type );
		const file = await uploadBlob(
			client,
			blob,
			`page-image.${ extForMime( got.type ) }`
		);
		set( {
			mediaIds: [ ...( state.mediaIds || [] ), file.id ],
			mediaItems: {
				...( state.mediaItems || {} ),
				[ file.id ]: { url: src, type: 'image', name: 'page image' },
			},
		} );
	};

	const getQuota = useCallback( async () => {
		const [ usage, x ] = await Promise.all( [
			client.getQuotaUsage(),
			client.getXUsage().catch( () => null ),
		] );
		return { usage, x };
	}, [ client ] );

	const submit = async ( mode ) => {
		setSubmitErr( '' );
		setDone( null );
		setApprovalBlocked( false );
		const scheduled = mode === 'schedule';
		if ( scheduled && ! state.scheduleAt ) {
			setSubmitErr( 'Pick a date and time to schedule.' );
			return;
		}
		setSubmitting( true );
		try {
			const body = buildPostBody( {
				content: resolvedCaption,
				channelIds: state.channels || [],
				perPlatform: resolvedPerChannel,
				mediaIds: state.mediaIds || [],
				scheduledAt: scheduled
					? new Date( state.scheduleAt ).toISOString()
					: undefined,
				timezone: browserTz(),
				requestApproval: !! state.requestApproval,
				linkTracking: ( settings && settings.linkTrackingDefault ) || 'default',
			} );
			const post = await client.createAndMaybePublish( body, {
				publishNow: ! scheduled,
			} );
			set( { bpPostId: post.id } );
			setDone( {
				scheduled,
				approvalStatus: post.approvalStatus || 'none',
			} );
		} catch ( e ) {
			setSubmitErr( errorMessage( e ) );
			setApprovalBlocked( isApprovalRequired( e ) );
			if ( e && e.bpPostId ) {
				set( { bpPostId: e.bpPostId } );
			}
		} finally {
			setSubmitting( false );
		}
	};

	if ( loadErr ) {
		return <Notice type="error">{ loadErr }</Notice>;
	}

	return (
		<div className="bp-composer">
			{ ! state.pageCardDismissed && (
				<PagePreview
					page={ pageContext }
					onInsert={ ( text ) =>
						insertAtCaret(
							captionRef.current,
							text,
							caption,
							( next ) => set( { caption: next } ),
							{ separate: true }
						)
					}
					onUseImage={ attachPageImage }
					onDismiss={ () => set( { pageCardDismissed: true } ) }
				/>
			) }

			<div className="bp-field">
				{ channels === null ? (
					<Spinner label="Loading channels…" />
				) : (
					<ChannelSelector
						channels={ channels }
						sets={ channelSets }
						onApplySet={ ( ids ) => {
							const cur = state.channels || [];
							set( {
								channels: [
									...cur,
									...ids.filter( ( id ) => ! cur.includes( id ) ),
								],
							} );
						} }
						selected={ state.channels || [] }
						onToggle={ ( id ) => {
							const cur = state.channels || [];
							set( {
								channels: cur.includes( id )
									? cur.filter( ( x ) => x !== id )
									: [ ...cur, id ],
							} );
						} }
					/>
				) }
			</div>

			<div className="bp-field">
				{ /* The character count lives in the sticky action bar, where it
				     stays visible while the caption is scrolled off. */ }
				<div className="bp-label">Caption</div>
				<Textarea
					ref={ captionRef }
					value={ caption }
					onChange={ ( e ) => set( { caption: e.target.value } ) }
					placeholder="Write your post…"
					error={ overLimits.length > 0 }
				/>
				<CaptionTokens
					onInsert={ ( token ) =>
						insertToken( captionRef.current, token, caption, ( next ) =>
							set( { caption: next } )
						)
					}
				/>
				{ overLimits.map( ( o ) => (
					<span className="bp-error-text" key={ o.platform }>
						{ platformLabel( o.platform ) }: { o.length }/{ o.limit } characters
					</span>
				) ) }
			</div>

			<div className="bp-field">
				<div className="bp-label">Media</div>
				<MediaField
					client={ client }
					ids={ state.mediaIds || [] }
					items={ state.mediaItems || {} }
					onChange={ ( ids, items ) =>
						set( { mediaIds: ids, mediaItems: items } )
					}
				/>
			</div>

			{ selectedPlatforms.length > 0 && (
				<details className="bp-details bp-field">
					<summary>Per-channel caption overrides</summary>
					<div className="bp-stack" style={ { marginTop: 12 } }>
						{ selectedPlatforms.map( ( p ) => (
							<div key={ p }>
								<div className="bp-label">{ platformLabel( p ) }</div>
								<Textarea
									value={ ( state.perChannel && state.perChannel[ p ] ) || '' }
									placeholder="Leave empty to use the main caption"
									onChange={ ( e ) =>
										set( {
											perChannel: {
												...( state.perChannel || {} ),
												[ p ]: e.target.value,
											},
										} )
									}
									style={ { minHeight: 70 } }
								/>
							</div>
						) ) }
					</div>
				</details>
			) }

			<div className="bp-field bp-stack" style={ { gap: 6 } }>
				<Toggle
					id="bp-request-approval"
					checked={ !! state.requestApproval }
					onChange={ ( v ) => set( { requestApproval: v } ) }
					label="Require approval"
				/>
				<span className="bp-hint">
					Holds the post for a teammate to approve before it goes out. If
					your BulkPublish role cannot publish, approval is always required.
				</span>
			</div>

			<div className="bp-field">
				<Toggle
					id="bp-schedule"
					checked={ !! state.scheduleEnabled }
					onChange={ ( v ) => set( { scheduleEnabled: v } ) }
					label="Schedule for later"
				/>
				{ state.scheduleEnabled && (
					<input
						type="datetime-local"
						className="bp-input"
						style={ { marginTop: 8 } }
						value={ state.scheduleAt || '' }
						onChange={ ( e ) => set( { scheduleAt: e.target.value } ) }
					/>
				) }
			</div>

			{ selectedPlatforms.length > 0 && (
				<CostTable
					platforms={ selectedPlatforms }
					hasLink={ hasLink }
					mediaCount={ ( state.mediaIds || [] ).length }
					getQuota={ getQuota }
				/>
			) }

			{ submitErr && <Notice type="error">{ submitErr }</Notice> }
			{ approvalBlocked && (
				<Notice type="warning">
					This post needs approval before it can go out. Tick “Require
					approval” and submit it — a teammate with approval rights can then
					release it from the BulkPublish dashboard.
				</Notice>
			) }
			{ done && (
				<Notice
					type={ done.approvalStatus === 'pending' ? 'warning' : 'success' }
				>
					{ done.approvalStatus === 'pending'
						? 'Submitted for approval. It will go out once a teammate approves it.'
						: done.scheduled
						? 'Scheduled on BulkPublish.'
						: 'Sent to BulkPublish.' }
				</Notice>
			) }

			{ state.bpPostId && (
				<div className="bp-field">
					<div className="bp-label">Status</div>
					<StatusList client={ client } postId={ state.bpPostId } />
				</div>
			) }

			{ /*
			  * Pinned to the bottom of the popup. Compose runs well past the
			  * ~600px Chrome allows a popup, so an in-flow button left the
			  * primary action hundreds of pixels below the fold.
			  */ }
			<div className="bp-actionbar">
				{ minLimit ? (
					<span
						className={ cx(
							'bp-charcount',
							overLimits.length && 'is-over'
						) }
					>
						{ resolvedCaption.length } / { minLimit }
					</span>
				) : (
					<span />
				) }
				{ state.scheduleEnabled ? (
					<Button
						onClick={ () => submit( 'schedule' ) }
						loading={ submitting }
						disabled={ ! canSubmit }
					>
						Schedule
					</Button>
				) : (
					<Button
						onClick={ () => submit( 'now' ) }
						loading={ submitting }
						disabled={ ! canSubmit }
					>
						Publish now
					</Button>
				) }
			</div>
		</div>
	);
}
