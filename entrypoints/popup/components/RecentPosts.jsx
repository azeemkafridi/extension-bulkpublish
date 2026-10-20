/**
 * Recent tab — the Social half of the WP plugin's Dashboard, rebuilt for a
 * 400px popup: one compact row per post (media thumbnail, platforms, state,
 * caption) with every action behind a kebab menu, so the card stays readable
 * no matter which combination of approve / retry / delete a post supports.
 */
import { useState, useEffect, useCallback } from 'react';
import { platformLabel, approvalLabel, APPROVAL_VARIANTS } from '@/lib/constants.js';
import { errorMessage } from '@/lib/api.js';
import { Badge, Notice, Spinner, Menu, MenuItem } from './ui.jsx';
import { PlatformMark } from './PlatformMark.jsx';
import { StatusList } from './StatusList.jsx';
import { SchedulePicker } from './SchedulePicker.jsx';
import { defaultScheduleAt, formatLocalDateTime, isFutureSchedule } from '@/lib/schedule.js';

const STATUS_VARIANT = {
	published: 'success',
	publishing: 'info',
	processing: 'info',
	pending: 'neutral',
	draft: 'neutral',
	scheduled: 'scheduled',
	failed: 'error',
	partial: 'warning',
	unconfirmed: 'warning',
};

const IconKebab = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<circle cx="12" cy="5" r="1.8" />
		<circle cx="12" cy="12" r="1.8" />
		<circle cx="12" cy="19" r="1.8" />
	</svg>
);

const IconPlay = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M8 5v14l11-7z" />
	</svg>
);

const isVideo = ( m ) => ( m.mimeType || '' ).startsWith( 'video/' );

/** Short, local, and only as precise as it needs to be at this size. */
function when( post ) {
	const raw = post.publishedAt || post.scheduledAt || post.createdAt;
	if ( ! raw ) {
		return '';
	}
	const d = new Date( raw );
	if ( Number.isNaN( d.getTime() ) ) {
		return '';
	}
	const sameYear = d.getFullYear() === new Date().getFullYear();
	return d.toLocaleString( undefined, {
		month: 'short',
		day: 'numeric',
		...( sameYear ? {} : { year: 'numeric' } ),
		hour: 'numeric',
		minute: '2-digit',
	} );
}

function Thumb( { media } ) {
	if ( ! media || media.length === 0 ) {
		return null;
	}
	const first = media[ 0 ];
	const src = first.thumbnailUrl || first.previewUrl || first.originalUrl;
	return (
		<div className="bp-post-thumb">
			{ ! src ? (
				<span className="bp-post-thumb-fallback">
					{ isVideo( first ) ? <IconPlay /> : '🖼' }
				</span>
			) : (
				<>
					<img src={ src } alt="" loading="lazy" />
					{ isVideo( first ) && <span className="bp-post-thumb-play"><IconPlay /></span> }
				</>
			) }
			{ media.length > 1 && (
				<span className="bp-post-thumb-more">+{ media.length - 1 }</span>
			) }
		</div>
	);
}

const RUNNING = new Set( [ 'publishing', 'processing' ] );
const EDITABLE = new Set( [ 'draft', 'scheduled', 'failed', 'partial' ] );

export function RecentPosts( { client, onEdit, onDuplicate } ) {
	const [ data, setData ] = useState( null );
	const [ err, setErr ] = useState( '' );
	const [ busyId, setBusyId ] = useState( null );
	const [ openId, setOpenId ] = useState( null );
	const [ scheduleId, setScheduleId ] = useState( null );
	const [ scheduleAt, setScheduleAt ] = useState( '' );
	const [ capabilities, setCapabilities ] = useState( null );

	const load = useCallback( async () => {
		try {
			const r = await client.listPosts( { page: 1, limit: 20 } );
			setData( r.posts || [] );
			setErr( '' );
		} catch ( e ) {
			setErr( errorMessage( e ) );
		}
	}, [ client ] );

	useEffect( () => {
		load();
		client.getCapabilities().then( setCapabilities ).catch( () => setCapabilities( {
			canCreatePosts: false,
			canPublishPosts: false,
			canApprovePosts: false,
		} ) );
	}, [ load ] );

	// Keep card-level badges current too. StatusList polling alone only updates
	// the expanded details and leaves the Recent card looking stuck.
	useEffect( () => {
		const isRunning = ( data || [] ).some( ( post ) =>
			RUNNING.has( post.status ) || ( post.postPlatforms || [] ).some( ( row ) => [ 'publishing', 'processing' ].includes( row.status ) )
		);
		if ( ! isRunning ) return undefined;
		const timer = setInterval( load, 4000 );
		return () => clearInterval( timer );
	}, [ data, load ] );

	const act = async ( id, fn ) => {
		setBusyId( id );
		try {
			await fn();
			await load();
			return true;
		} catch ( e ) {
			setErr( errorMessage( e ) );
			return false;
		} finally {
			setBusyId( null );
		}
	};

	const retry = ( postId, options = {} ) => act( postId, async () => {
		try {
			await client.retryPost( postId, options );
		} catch ( e ) {
			if ( e?.code !== 'UNCONFIRMED_REQUIRES_REPUBLISH' ) throw e;
			// eslint-disable-next-line no-alert
			if ( ! window.confirm( 'BulkPublish could not confirm whether this post went live. Check the account first. Retry anyway? This may create a duplicate.' ) ) return;
			await client.retryPost( postId, { ...options, republish: true } );
		}
	} );

	const publishNow = ( id ) => {
		// Publishing is externally visible and cannot be undone.
		// eslint-disable-next-line no-alert
		if ( window.confirm( 'Publish this post now?' ) ) {
			act( id, () => client.publishPost( id ) );
		}
	};

	const openComposer = async ( post, duplicate = false ) => {
		setBusyId( post.id );
		try {
			const full = await client.getPost( post.id );
			( duplicate ? onDuplicate : onEdit )?.( full.post || full );
		} catch ( e ) {
			setErr( errorMessage( e ) );
		} finally {
			setBusyId( null );
		}
	};

	const openSchedule = ( post ) => {
		const existing = post.scheduledAt ? new Date( post.scheduledAt ) : null;
		setScheduleAt( existing && existing > new Date() ? formatLocalDateTime( existing ) : defaultScheduleAt() );
		setScheduleId( post.id );
	};

	const saveSchedule = ( id ) => {
		if ( ! isFutureSchedule( scheduleAt ) ) {
			setErr( 'Choose a schedule time in the future.' );
			return;
		}
		act( id, () => client.updatePost( id, {
			status: 'scheduled',
			scheduledAt: new Date( scheduleAt ).toISOString(),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
		} ) ).then( ( saved ) => saved && setScheduleId( null ) );
	};

	const reject = ( id ) => {
		// eslint-disable-next-line no-alert
		const reason = window.prompt( 'Reason for rejecting (optional):', '' );
		if ( reason === null ) {
			return;
		}
		act( id, () => client.rejectPost( id, reason ) );
	};

	const remove = ( id ) => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( 'Delete this post from BulkPublish?' ) ) {
			return;
		}
		act( id, () => client.deletePost( id ) );
	};

	if ( err && ! data ) {
		return <Notice type="error">{ err }</Notice>;
	}
	if ( ! data ) {
		return <Spinner label="Loading posts…" />;
	}
	if ( data.length === 0 ) {
		return <p className="bp-muted">No posts yet — compose one from the first tab.</p>;
	}

	return (
		<div className="bp-stack" style={ { gap: 8 } }>
			{ err && <Notice type="error">{ err }</Notice> }
			{ data.map( ( post ) => {
				const media = [ ...( post.mediaFiles || [] ), ...( post.threadMediaFiles || [] ) ];
				const platforms = [
					...new Set( ( post.postPlatforms || [] ).map( ( pp ) => pp.platform ) ),
				];
				const approval = post.approvalStatus || 'none';
				const canRetry = ( post.postPlatforms || [] ).some(
					( pp ) => pp.status === 'failed' || pp.status === 'unconfirmed'
				);
				const busy = busyId === post.id;
				const stamp = when( post );
				const running = RUNNING.has( post.status ) || ( post.postPlatforms || [] ).some( ( row ) => [ 'publishing', 'processing' ].includes( row.status ) );
				const editable = EDITABLE.has( post.status );

				return (
					<div className="bp-post-card" key={ post.id } data-busy={ busy }>
						<div className="bp-post-row">
							<Thumb media={ media } />

							<div className="bp-post-body">
								<div className="bp-post-head">
									<span className="bp-post-marks">
										{ platforms.map( ( p ) => (
											<PlatformMark platform={ p } key={ p } />
										) ) }
									</span>
									<Badge variant={ STATUS_VARIANT[ post.status ] || 'neutral' }>
										{ post.status }
									</Badge>
									{ approval !== 'none' && (
										<Badge variant={ APPROVAL_VARIANTS[ approval ] || 'neutral' }>
											{ approvalLabel( approval ) }
										</Badge>
									) }
								</div>

								<div className="bp-post-content">
									{ ( post.content || '' ).trim() || (
										<em className="bp-muted">
											{ media.length ? 'Media only' : 'No content' }
										</em>
									) }
								</div>

								{ ( stamp || media.length > 0 ) && (
									<div className="bp-post-meta">
										{ stamp }
										{ stamp && media.length > 0 && ' · ' }
										{ media.length > 0 &&
											`${ media.length } ${
												media.length === 1 ? 'file' : 'files'
											}` }
									</div>
								) }
							</div>

							<Menu icon={ <IconKebab /> } label="Post actions">
								<MenuItem
									active={ openId === post.id }
									onClick={ () =>
										setOpenId( openId === post.id ? null : post.id )
									}
								>
									{ openId === post.id ? 'Hide status' : 'View status' }
								</MenuItem>
								{ capabilities?.canCreatePosts && editable && (
									<MenuItem disabled={ busy } onClick={ () => openComposer( post ) }>
										{ approval === 'rejected' ? 'Edit and resubmit' : 'Edit' }
									</MenuItem>
								) }
								{ capabilities?.canCreatePosts && post.status === 'draft' && (
									<MenuItem disabled={ busy } onClick={ () => openSchedule( post ) }>Schedule</MenuItem>
								) }
								{ capabilities?.canCreatePosts && post.status === 'scheduled' && (
									<MenuItem disabled={ busy } onClick={ () => openSchedule( post ) }>Reschedule</MenuItem>
								) }
								{ capabilities?.canPublishPosts && [ 'draft', 'scheduled' ].includes( post.status ) && approval !== 'pending' && (
									<MenuItem disabled={ busy } onClick={ () => publishNow( post.id ) }>Publish now</MenuItem>
								) }
								{ capabilities?.canCreatePosts && post.status === 'scheduled' && (
									<MenuItem disabled={ busy } onClick={ () => act( post.id, () => client.updatePost( post.id, { status: 'draft', scheduledAt: null } ) ) }>
										Cancel schedule
									</MenuItem>
								) }
								{ capabilities?.canCreatePosts && post.status === 'published' && (
									<MenuItem disabled={ busy } onClick={ () => openComposer( post, true ) }>Duplicate</MenuItem>
								) }
								{ running && (
									<MenuItem disabled={ busy } onClick={ () => act( post.id, () => Promise.resolve() ) }>Refresh status</MenuItem>
								) }
								{ capabilities?.canApprovePosts && approval === 'pending' && (
									<MenuItem
										disabled={ busy }
										onClick={ () =>
											act( post.id, () => client.approvePost( post.id ) )
										}
									>
										Approve
									</MenuItem>
								) }
								{ capabilities?.canApprovePosts && approval === 'pending' && (
									<MenuItem disabled={ busy } onClick={ () => reject( post.id ) }>
										Reject
									</MenuItem>
								) }
								{ capabilities?.canPublishPosts && canRetry && (
									<MenuItem
										disabled={ busy }
										onClick={ () =>
											retry( post.id )
										}
									>
										Retry failed
									</MenuItem>
								) }
								{ capabilities?.canCreatePosts && (
									<MenuItem danger disabled={ busy } onClick={ () => remove( post.id ) }>
										Delete
									</MenuItem>
								) }
							</Menu>
						</div>

						{ scheduleId === post.id && (
							<div className="bp-post-schedule">
								<SchedulePicker value={ scheduleAt } onChange={ setScheduleAt } />
								<div className="bp-post-schedule-actions">
									<button type="button" className="bp-btn bp-btn-ghost bp-btn-sm" onClick={ () => setScheduleId( null ) }>Cancel</button>
									<button type="button" className="bp-btn bp-btn-primary bp-btn-sm" disabled={ busy } onClick={ () => saveSchedule( post.id ) }>Save schedule</button>
								</div>
							</div>
						) }

						{ openId === post.id && (
							<div className="bp-post-status">
								<StatusList client={ client } postId={ post.id } poll showPostActions={ false } allowPlatformRetry={ !! capabilities?.canPublishPosts } onChanged={ load } />
							</div>
						) }
					</div>
				);
			} ) }
			<span className="bp-hint">
				Showing the latest 20 —{ ' ' }
				<a
					className="bp-link"
					href="https://app.bulkpublish.com/posts"
					target="_blank"
					rel="noopener noreferrer"
				>
					open the full dashboard
				</a>
				{ ' ' }for everything else.
			</span>
		</div>
	);
}
