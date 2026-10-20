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
import { browser } from 'wxt/browser';
import { PublishControl, usePublishingRun } from './PublishControl.jsx';
import { CostTable } from './CostTable.jsx';
import { insertAtCaret } from '@/lib/caret.js';
import { PagePreview } from './PagePreview.jsx';
import { SchedulePicker } from './SchedulePicker.jsx';
import { PostTypeField } from './PostTypeField.jsx';
import { PlatformOptions } from './PlatformOptions.jsx';
import { ThreadField } from './ThreadField.jsx';
import {
	resolvePostTypes,
	validatePlatformMedia,
	validatePlatformOptions,
	validateThread,
} from '@/lib/platform-capabilities.js';
import {
	defaultScheduleAt,
	isFutureSchedule,
	submissionScheduleAt,
} from '@/lib/schedule.js';

const browserTz = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch ( e ) {
		return 'UTC';
	}
};

export function Composer( {
	client,
	state,
	setState,
	pageContext,
	settings,
	staleDraft,
	onStartFresh,
} ) {
	const run = usePublishingRun( client );
	const submissionLock = useRef( false );
	const [ channels, setChannels ] = useState( null );
	const [ channelSets, setChannelSets ] = useState( [] );
	const [ loadErr, setLoadErr ] = useState( '' );
	const [ submitting, setSubmitting ] = useState( false );
	const [ submitErr, setSubmitErr ] = useState( '' );
	const [ approvalBlocked, setApprovalBlocked ] = useState( false );
	const [ overridePlatform, setOverridePlatform ] = useState( '' );
	const captionRef = useRef( null );
	// Clicking a page-card chip moves focus to the chip before its click event.
	// Keep the textarea's most recent range so that click still inserts exactly
	// where the user left their caret (or replaces their selection).
	const captionSelectionRef = useRef( null );
	const rememberCaptionSelection = ( target ) => {
		captionSelectionRef.current = {
			start: target.selectionStart ?? target.value.length,
			end: target.selectionEnd ?? target.value.length,
		};
	};

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

	const set = ( patch ) => setState( ( previous ) => ( { ...previous, ...patch } ) );

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
	const selectedPlatforms = useMemo( () => {
		const seen = {};
		( channels || [] ).forEach( ( c ) => {
			if ( ( state.channels || [] ).includes( c.id ) ) {
				seen[ c.platform ] = true;
			}
		} );
		return Object.keys( seen );
	}, [ channels, state.channels ] );
	const selectedChannels = useMemo(
		() => ( channels || [] )
			.filter( ( channel ) => ( state.channels || [] ).includes( channel.id ) )
			.map( ( channel ) => ( {
				channelId: channel.id,
				platform: channel.platform,
				accountName: channel.accountName,
				platformAvailable: channel.platformAvailable,
				platformMessage: channel.platformMessage,
				needsReconnect: channel.needsReconnect,
				tokenStatus: channel.tokenStatus,
			} ) ),
		[ channels, state.channels ]
	);
	// A channel can be disconnected while the popup is closed. Remove IDs that
	// no longer exist instead of leaving an invisible selection that satisfies
	// the button's count check but is rejected by the API at submission time.
	useEffect( () => {
		if ( channels === null ) return;
		const knownIds = new Set( channels.map( ( channel ) => channel.id ) );
		const current = state.channels || [];
		const next = current.filter( ( id ) => knownIds.has( id ) );
		if ( next.length !== current.length ) {
			set( { channels: next } );
		}
	}, [ channels, ( state.channels || [] ).join( '|' ) ] );
	const postFormat = state.postFormat || 'post';
	const threadMediaIds = useMemo(
		() => [ ...new Set( ( state.threadParts || [] ).flatMap( ( part ) => part.mediaFileIds || [] ) ) ],
		[ state.threadParts ]
	);
	const resolvedPostTypes = useMemo(
		() => resolvePostTypes( selectedPlatforms, state.postTypeOverrides, postFormat ),
		[ selectedPlatforms, state.postTypeOverrides, postFormat ]
	);
	const mediaErrors = useMemo(
		() => validatePlatformMedia( {
			platforms: selectedPlatforms,
			postTypes: resolvedPostTypes,
			mediaIds: state.mediaIds || [],
			mediaItems: state.mediaItems || {},
			postFormat,
		} ),
		[ selectedPlatforms, resolvedPostTypes, state.mediaIds, state.mediaItems, postFormat ]
	);
	const threadErrors = useMemo(
		() => postFormat === 'thread'
			? validateThread( {
				channels: selectedChannels,
				parts: state.threadParts || [],
				mediaItems: state.mediaItems || {},
				limits: PLATFORM_LIMITS,
			} )
			: [],
		[ postFormat, selectedChannels, state.threadParts ]
	);
	const resolvedPerChannel = useMemo( () => {
		// A platform-specific caption has no meaning for a one-channel post.
		// Keep saved overrides around in case the user adds channels again, but
		// do not send or count them until there is more than one target.
		if ( ( state.channels || [] ).length < 2 ) {
			return {};
		}
		const out = {};
		Object.entries( state.perChannel || {} ).forEach( ( [ p, t ] ) => {
			if ( selectedPlatforms.includes( p ) ) {
				out[ p ] = resolveTokens( t || '', tokenValues );
			}
		} );
		return out;
	}, [ state.channels, state.perChannel, selectedPlatforms, tokenValues ] );
	const optionErrors = useMemo(
		() => postFormat === 'thread' ? [] : validatePlatformOptions( {
			channels: selectedChannels,
			platformSpecific: state.platformSpecific || {},
			postTypes: resolvedPostTypes,
			// TikTok's platform caption is its title. A valid custom TikTok
			// caption must satisfy this even when the shared caption is blank.
			content: resolvedPerChannel.tiktok || resolvedCaption,
			mediaIds: state.mediaIds || [],
			mediaItems: state.mediaItems || {},
		} ),
		[ selectedChannels, state.platformSpecific, resolvedPostTypes, resolvedPerChannel, resolvedCaption, state.mediaIds, state.mediaItems, postFormat ]
	);

	const overLimits = useMemo(
		() => postFormat === 'thread'
			? []
			: checkLimits( {
				platforms: selectedPlatforms,
				content: resolvedCaption,
				perPlatform: resolvedPerChannel,
				limits: PLATFORM_LIMITS,
			} ),
		[ selectedPlatforms, resolvedCaption, resolvedPerChannel, postFormat ]
	);

	const hasLink = useMemo(
		() => postFormat === 'thread'
			? detectLink( ( state.threadParts || [] ).map( ( part ) => part.content || '' ).join( '\n' ), {} )
			: detectLink( resolvedCaption, resolvedPerChannel ),
		[ resolvedCaption, resolvedPerChannel, postFormat, state.threadParts ]
	);

	const minLimit = useMemo( () => {
		const limits = selectedPlatforms
			.map( ( p ) => PLATFORM_LIMITS[ p ] )
			.filter( Boolean );
		return limits.length ? Math.min( ...limits ) : null;
	}, [ selectedPlatforms ] );
	const hasMultipleChannels = ( state.channels || [] ).length > 1;
	const customCaptionPlatforms = selectedPlatforms.filter( ( platform ) =>
		String( state.perChannel?.[ platform ] || '' ).trim()
	);
	const unavailableChannels = selectedChannels.filter( ( channel ) =>
		channel.platformAvailable === false || channel.needsReconnect ||
		channel.tokenStatus === 'expired'
	);

	// Restored drafts must reveal their active custom caption instead of showing
	// the misleading "main caption for every channel" option.
	useEffect( () => {
		if ( ! hasMultipleChannels || ! selectedPlatforms.includes( overridePlatform ) ) {
			setOverridePlatform( customCaptionPlatforms[ 0 ] || '' );
		}
	}, [ hasMultipleChannels, selectedPlatforms.join( '|' ), customCaptionPlatforms.join( '|' ) ] );

	const hasContent = postFormat === 'thread'
		? ( state.threadParts || [] ).some( ( part ) => ( part.content || '' ).trim() )
		: resolvedCaption.trim().length > 0 || ( state.mediaIds || [] ).length > 0;
	const canSubmit =
		! run && ! ( state.bpPostId && ! state.editingPostId ) &&
		( state.channels || [] ).length > 0 &&
		hasContent &&
		overLimits.length === 0 &&
		mediaErrors.length === 0 &&
		optionErrors.length === 0 &&
		threadErrors.length === 0 &&
		unavailableChannels.length === 0 &&
		! submitting;

	/**
	 * Detaching media should also reclaim the storage it used, but the server's
	 * DELETE does not reference-check — `posts.mediaFiles` is a JSONB array,
	 * not a foreign key — so deleting a file a post already points at would
	 * leave that post referencing nothing.
	 *
	 * Everything in this composer was uploaded by this draft (there is no
	 * library picker) and uploads are never de-duplicated server-side, so the
	 * file is ours alone right up until a post is created from it. Once
	 * `bpPostId` exists we only detach locally and leave the file to the
	 * server's own retention sweep.
	 *
	 * Cleanup is best-effort: the file is already gone from the composer, and
	 * that sweep collects anything this misses ("uploads abandoned before
	 * submit" is a case it names explicitly), so a failure needs no interruption.
	 */
	const releaseMedia = ( id ) => {
		if ( state.bpPostId || state.protectMedia ) {
			return;
		}
		client.deleteMedia( id ).catch( () => {} );
	};

	const changeThreadParts = ( threadParts ) => {
		const previousIds = new Set( ( state.threadParts || [] ).flatMap( ( part ) => part.mediaFileIds || [] ) );
		const nextIds = new Set( threadParts.flatMap( ( part ) => part.mediaFileIds || [] ) );
		const mediaItems = { ...( state.mediaItems || {} ) };
		for ( const id of previousIds ) {
			if ( ! nextIds.has( id ) && ! ( state.mediaIds || [] ).includes( id ) ) {
				delete mediaItems[ id ];
				releaseMedia( id );
			}
		}
		set( { threadParts, mediaItems } );
	};

	const changeFormat = ( nextFormat ) => {
		if ( nextFormat === postFormat ) return;
		if ( nextFormat === 'thread' ) {
			set( {
				postFormat: 'thread',
				...( ! ( state.threadParts || [] ).some( ( part ) => part.content?.trim() )
					? { threadParts: [ { content: caption, mediaFileIds: [] }, { content: '', mediaFileIds: [] } ] }
					: {} ),
			} );
			return;
		}
		set( {
			postFormat: 'post',
			// Match the web composer: the first thread post becomes the main
			// caption when leaving thread mode. Normal-post media stays separate.
			caption: state.threadParts?.[ 0 ]?.content || caption,
		} );
	};

	// A channel selection can change while thread mode is active. Never leave
	// the UI in a hidden/invalid Thread state after an unsupported platform is
	// added; keep the authored first post as the normal caption.
	useEffect( () => {
		if ( postFormat === 'thread' && selectedPlatforms.some( ( platform ) => ! [ 'x', 'threads', 'bluesky', 'mastodon' ].includes( platform ) ) ) {
			changeFormat( 'post' );
		}
	}, [ postFormat, selectedPlatforms.join( '|' ) ] );

	const getQuota = useCallback( async () => {
		const [ usage, x ] = await Promise.all( [
			client.getQuotaUsage(),
			client.getXUsage().catch( () => null ),
		] );
		return { usage, x };
	}, [ client ] );

	const submit = async ( mode ) => {
		if ( submissionLock.current || run || ! canSubmit ) return;
		setSubmitErr( '' );
		setApprovalBlocked( false );
		const scheduled = mode === 'schedule';
		if ( scheduled && ! state.scheduleAt ) {
			setSubmitErr( 'Pick a date and time to schedule.' );
			return;
		}
		if ( scheduled && ! isFutureSchedule( state.scheduleAt ) ) {
			setSubmitErr( 'Choose a schedule time in the future.' );
			return;
		}
		setSubmitting( true );
		submissionLock.current = true;
		// The action bar is sticky at the bottom of a long composer. Bring the
		// newly rendered progress/result region into view instead of leaving it
		// hidden above the user's current scroll position.
		window.scrollTo( { top: 0, behavior: 'smooth' } );
		try {
			// A known approval request goes straight into the pending scheduled
			// flow. A normal "Publish now" keeps the established draft → publish
			// path; contributors are converted to pending by approvalFallback below.
			const immediateApproval = ! scheduled && !! state.requestApproval;
			const submissionTime = scheduled
				? submissionScheduleAt( mode, state.scheduleAt )
				: immediateApproval
					// An edit is a PUT, which refuses a time that is not in the
					// future — "now" is already past on arrival, so every edit of a
					// post awaiting approval failed with 400. Same +2 min as the
					// approvalFallback below; approval releases it as overdue.
					? ( state.editingPostId ? new Date( Date.now() + 2 * 60 * 1000 ).toISOString() : submissionScheduleAt( 'now', '' ) )
					: undefined;
			const platformSpecific = state.firstComment?.trim()
				? { ...( state.platformSpecific || {} ), _firstComment: state.firstComment.trim() }
				: state.platformSpecific || {};
			const body = buildPostBody( {
				content: postFormat === 'thread'
					? ( state.threadParts?.[ 0 ]?.content || '' )
					: resolvedCaption,
				channelIds: state.channels || [],
				channelEntries: selectedChannels,
				perPlatform: postFormat === 'thread' ? {} : resolvedPerChannel,
				mediaIds: postFormat === 'thread' ? [] : state.mediaIds || [],
				scheduledAt: submissionTime,
				timezone: browserTz(),
				requestApproval: !! state.requestApproval,
				linkTracking: state.linkTracking ?? ( settings && settings.linkTrackingDefault ) ?? 'default',
				postFormat,
				postTypeOverrides: resolvedPostTypes,
				platformSpecific,
				threadParts: postFormat === 'thread' ? state.threadParts || [] : undefined,
				forUpdate: !! state.editingPostId,
			} );
			const submitOptions = {
				publishNow: ! scheduled && ! immediateApproval,
				approvalFallback: {
					...body,
					status: 'scheduled',
					// PUT requires a future time. If approved after this point, the
					// approve route releases it immediately as an overdue post.
					scheduledAt: new Date( Date.now() + 2 * 60 * 1000 ).toISOString(),
					requestApproval: true,
				},
			};
			const response = await browser.runtime.sendMessage( {
				type: 'bulkpublish-submit', body, options: submitOptions,
				editingPostId: state.editingPostId,
				draft: { ...state, pageContext },
			} );
			if ( response.error ) {
				const failure = new Error( response.error );
				failure.code = response.code;
				failure.bpPostId = response.bpPostId;
				throw failure;
			}
			const post = response.post;
			set( { bpPostId: post.id, editingPostId: null, published: true } );
		} catch ( e ) {
			setSubmitErr( errorMessage( e ) );
			setApprovalBlocked( isApprovalRequired( e ) );
			if ( e && e.bpPostId ) {
				set( { bpPostId: e.bpPostId } );
			}
		} finally {
			setSubmitting( false );
			submissionLock.current = false;
		}
	};

	if ( loadErr ) {
		return <Notice type="error">{ loadErr }</Notice>;
	}

	return (
		<div className="bp-composer">
			<div className="bp-submit-status" aria-live="polite" aria-atomic="false">
				{ submitErr && ! run && <Notice type="error">{ submitErr }</Notice> }
				{ approvalBlocked && (
					<Notice type="warning">
						This post needs approval before it can go out. Tick “Require
						approval” and submit it — a teammate with approval rights can then
						release it from the BulkPublish dashboard.
					</Notice>
				) }
				{ ! run && state.bpPostId && ! state.editingPostId && (
					<div className="bp-publish-status">
						<StatusList client={ client } postId={ state.bpPostId } />
					</div>
				) }
			</div>
			<div className="bp-compose-fields" inert={run || submitting ? '' : undefined}>
			{ staleDraft && (
				<div className="bp-stale-draft" role="status">
					<span>Draft.</span>
					<button type="button" className="bp-stale-draft-action" onClick={ onStartFresh }>
						Start fresh with this page.
					</button>
				</div>
			) }
			{ ! state.pageCardDismissed && (
				<PagePreview
					page={ pageContext }
					onInsert={ ( text ) => postFormat === 'thread'
						? set( {
							threadParts: ( state.threadParts || [] ).map( ( part, index ) => index === 0
								? { ...part, content: [ part.content, text ].filter( Boolean ).join( '\n\n' ) }
								: part ),
						} )
						: insertAtCaret(
							captionRef.current,
							text,
							caption,
							( next ) => set( { caption: next } ),
							{
								separate: true,
								selection: captionSelectionRef.current,
								onSelectionChange: ( nextSelection ) => {
									captionSelectionRef.current = nextSelection;
								},
							}
						)
					}
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
				{ unavailableChannels.map( ( channel ) => (
					<span className="bp-error-text" key={ `channel-${ channel.channelId }` }>
						{ channel.accountName || platformLabel( channel.platform ) }: { channel.platformAvailable === false
							? channel.platformMessage || 'This platform is temporarily unavailable.'
							: 'Reconnect this channel in BulkPublish before publishing.' }
					</span>
				) ) }
			</div>

			<PostTypeField
				platforms={ selectedPlatforms }
				postFormat={ postFormat }
				postTypes={ resolvedPostTypes }
				mediaErrors={ mediaErrors }
				onFormatChange={ changeFormat }
				onPostTypeChange={ ( platform, postType ) => set( {
					postTypeOverrides: { ...( state.postTypeOverrides || {} ), [ platform ]: postType },
				} ) }
			/>

			{ postFormat !== 'thread' && <>
			<div className="bp-field">
				{ /* The character count lives in the sticky action bar, where it
				     stays visible while the caption is scrolled off. */ }
				<div className="bp-label">Caption</div>
				<Textarea
					ref={ captionRef }
					value={ caption }
					onChange={ ( e ) => {
						rememberCaptionSelection( e.target );
						set( { caption: e.target.value } );
					} }
					onSelect={ ( e ) => rememberCaptionSelection( e.target ) }
					onBlur={ ( e ) => rememberCaptionSelection( e.target ) }
					onKeyUp={ ( e ) => rememberCaptionSelection( e.target ) }
					onClick={ ( e ) => rememberCaptionSelection( e.target ) }
					placeholder="Write your post…"
					error={ overLimits.length > 0 }
				/>
				{ /* No token chips here: the page card above already offers the
				     same inserts, and duplicating them just costs a row. */ }
				{ overLimits.map( ( o ) => (
					<span className="bp-error-text" key={ o.platform }>
						{ platformLabel( o.platform ) }: { o.length }/{ o.limit } characters
					</span>
				) ) }
			</div>

			{ hasMultipleChannels && selectedPlatforms.length > 0 && (
				<div className="bp-field bp-override-field">
					<div className="bp-override-select-wrap">
						<select
							className="bp-override-select"
							value={ overridePlatform }
							onChange={ ( event ) => {
								const platform = event.target.value;
								setOverridePlatform( platform );
								if ( ! platform ) {
									set( { perChannel: {} } );
								}
							} }
						>
							<option value="">Use the main caption for every channel</option>
							{ selectedPlatforms.map( ( platform ) => (
								<option key={ platform } value={ platform }>
									{ platformLabel( platform ) }
									{ customCaptionPlatforms.includes( platform ) ? ' — customized' : '' }
								</option>
							) ) }
						</select>
						<svg className="bp-override-chevron" viewBox="0 0 24 24" aria-hidden="true">
							<path d="m6 9 6 6 6-6" />
						</svg>
					</div>
					{ overridePlatform && (
						<Textarea
							value={ ( state.perChannel && state.perChannel[ overridePlatform ] ) || '' }
							onChange={ ( event ) =>
								set( {
									perChannel: {
										...( state.perChannel || {} ),
										[ overridePlatform ]: event.target.value,
									},
								} )
							}
							style={ { minHeight: 70, marginTop: 8 } }
						/>
					) }
				</div>
			) }

			</> }

			<PlatformOptions
				client={ client }
				channels={ selectedChannels }
				postTypes={ resolvedPostTypes }
				value={ state.platformSpecific || {} }
				onChange={ ( platformSpecific ) => set( { platformSpecific } ) }
			/>
			{ optionErrors.length > 0 && (
				<div className="bp-option-errors">
					{ optionErrors.map( ( error ) => <span className="bp-error-text" key={ error }>{ error }</span> ) }
				</div>
			) }

			{ postFormat === 'thread' ? (
				<div className="bp-field">
					<div className="bp-label">Thread</div>
					<ThreadField
						client={ client }
						channels={ selectedChannels }
						parts={ state.threadParts || [ { content: '', mediaFileIds: [] }, { content: '', mediaFileIds: [] } ] }
						mediaItems={ state.mediaItems || {} }
						pageImage={ pageContext.image }
						onChange={ changeThreadParts }
						onPartMediaChange={ ( partIndex, ids, mediaItems ) => {
							const threadParts = ( state.threadParts || [] ).map( ( part, index ) =>
								index === partIndex ? { ...part, mediaFileIds: ids } : part
							);
							set( { threadParts, mediaItems } );
						} }
						onRemoveMedia={ releaseMedia }
					/>
					{ threadErrors.map( ( error ) => <span className="bp-error-text" key={ error }>{ error }</span> ) }
				</div>
			) : (
				<div className="bp-field">
					<div className="bp-label">Media</div>
					<MediaField
						client={ client }
						ids={ state.mediaIds || [] }
						items={ state.mediaItems || {} }
						pageImage={ pageContext.image }
						onChange={ ( ids, items ) => set( { mediaIds: ids, mediaItems: items } ) }
						onRemove={ releaseMedia }
					/>
				</div>
			) }

			{ selectedChannels.some( ( channel ) => [ 'instagram', 'facebook', 'x', 'linkedin', 'threads', 'bluesky', 'youtube', 'mastodon' ].includes( channel.platform ) ) && (
				<div className="bp-field">
					<div className="bp-label">First comment</div>
					<Textarea
						value={ state.firstComment || '' }
						onChange={ ( event ) => set( { firstComment: event.target.value } ) }
						placeholder="Posted as a reply after publishing (optional)"
						style={ { minHeight: 64 } }
					/>
				</div>
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
					onChange={ ( v ) =>
						set( {
							scheduleEnabled: v,
							...( v && ! isFutureSchedule( state.scheduleAt )
								? { scheduleAt: defaultScheduleAt() }
								: {} ),
						} )
					}
					label="Schedule for later"
				/>
				{ state.scheduleEnabled && (
					<SchedulePicker
						value={ state.scheduleAt || '' }
						onChange={ ( scheduleAt ) => set( { scheduleAt } ) }
					/>
				) }
			</div>

			{ selectedPlatforms.length > 0 && (
				<CostTable
					platforms={ selectedPlatforms }
					hasLink={ hasLink }
					mediaCount={ postFormat === 'thread' ? threadMediaIds.length : ( state.mediaIds || [] ).length }
					getQuota={ getQuota }
				/>
			) }

			</div>
			{ /*
			  * Pinned to the bottom of the popup. Compose runs well past the
			  * ~600px Chrome allows a popup, so an in-flow button left the
			  * primary action hundreds of pixels below the fold.
			  */ }
			<div className="bp-actionbar">
				{ postFormat !== 'thread' && minLimit ? (
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
				{ run ? <PublishControl run={run} client={client} onDone={onStartFresh}/> : state.scheduleEnabled ? (
					<Button
						onClick={ () => submit( 'schedule' ) }
						loading={ submitting }
						disabled={ ! canSubmit }
					>
						{ submitting ? 'Scheduling…' : 'Schedule' }
					</Button>
				) : (
					<Button
						onClick={ () => submit( 'now' ) }
						loading={ submitting }
						disabled={ ! canSubmit }
					>
						{ submitting ? 'Publishing…' : 'Publish now' }
					</Button>
				) }
			</div>
		</div>
	);
}
