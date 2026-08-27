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

const STATUS_VARIANT = {
	published: 'success',
	publishing: 'info',
	processing: 'info',
	pending: 'neutral',
	draft: 'neutral',
	scheduled: 'scheduled',
	failed: 'error',
	partial: 'warning',
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
			{ isVideo( first ) || ! src ? (
				<span className="bp-post-thumb-fallback">
					{ isVideo( first ) ? <IconPlay /> : '🖼' }
				</span>
			) : (
				<img src={ src } alt="" loading="lazy" />
			) }
			{ media.length > 1 && (
				<span className="bp-post-thumb-more">+{ media.length - 1 }</span>
			) }
		</div>
	);
}

export function RecentPosts( { client } ) {
	const [ data, setData ] = useState( null );
	const [ err, setErr ] = useState( '' );
	const [ busyId, setBusyId ] = useState( null );
	const [ openId, setOpenId ] = useState( null );

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
	}, [ load ] );

	const act = async ( id, fn ) => {
		setBusyId( id );
		try {
			await fn();
			await load();
		} catch ( e ) {
			setErr( errorMessage( e ) );
		} finally {
			setBusyId( null );
		}
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
				const media = post.mediaFiles || [];
				const platforms = [
					...new Set( ( post.postPlatforms || [] ).map( ( pp ) => pp.platform ) ),
				];
				const approval = post.approvalStatus || 'none';
				const canRetry = ( post.postPlatforms || [] ).some(
					( pp ) => pp.status === 'failed' || pp.status === 'partial'
				);
				const busy = busyId === post.id;
				const stamp = when( post );

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
								{ approval === 'pending' && (
									<MenuItem
										disabled={ busy }
										onClick={ () =>
											act( post.id, () => client.approvePost( post.id ) )
										}
									>
										Approve
									</MenuItem>
								) }
								{ approval === 'pending' && (
									<MenuItem disabled={ busy } onClick={ () => reject( post.id ) }>
										Reject
									</MenuItem>
								) }
								{ canRetry && (
									<MenuItem
										disabled={ busy }
										onClick={ () =>
											act( post.id, () => client.retryPost( post.id ) )
										}
									>
										Retry failed
									</MenuItem>
								) }
								<MenuItem danger disabled={ busy } onClick={ () => remove( post.id ) }>
									Delete
								</MenuItem>
							</Menu>
						</div>

						{ openId === post.id && (
							<div className="bp-post-status">
								<StatusList client={ client } postId={ post.id } poll={ false } />
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
