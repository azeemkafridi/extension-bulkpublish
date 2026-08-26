/**
 * Recent tab — the Social half of the WP plugin's Dashboard: recent
 * BulkPublish posts with approve/reject/retry/delete, plus expandable
 * per-channel status.
 */
import { useState, useEffect, useCallback } from 'react';
import {
	platformLabel,
	approvalLabel,
	APPROVAL_VARIANTS,
} from '@/lib/constants.js';
import { errorMessage } from '@/lib/api.js';
import { Badge, Button, Notice, Spinner } from './ui.jsx';
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
		<div className="bp-stack" style={ { gap: 10 } }>
			{ err && <Notice type="error">{ err }</Notice> }
			{ data.map( ( post ) => {
				const platforms = ( post.postPlatforms || [] ).map( ( pp ) => pp.platform );
				const approval = post.approvalStatus || 'none';
				const canRetry = ( post.postPlatforms || [] ).some(
					( pp ) => pp.status === 'failed' || pp.status === 'partial'
				);
				return (
					<div className="bp-post-card" key={ post.id }>
						<div className="bp-post-head">
							<span className="bp-post-marks">
								{ [ ...new Set( platforms ) ].map( ( p ) => (
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
							{ ( post.content || '' ).slice( 0, 140 ) || (
								<em className="bp-muted">(media only)</em>
							) }
						</div>
						<div className="bp-row" style={ { gap: 6, flexWrap: 'wrap' } }>
							{ approval === 'pending' && (
								<>
									<Button
										variant="secondary"
										size="sm"
										loading={ busyId === post.id }
										onClick={ () =>
											act( post.id, () => client.approvePost( post.id ) )
										}
									>
										Approve
									</Button>
									<Button
										variant="ghost"
										size="sm"
										loading={ busyId === post.id }
										onClick={ () => {
											// eslint-disable-next-line no-alert
											const reason = window.prompt(
												'Reason for rejecting (optional):',
												''
											);
											if ( reason === null ) {
												return;
											}
											act( post.id, () =>
												client.rejectPost( post.id, reason )
											);
										} }
									>
										Reject
									</Button>
								</>
							) }
							{ canRetry && (
								<Button
									variant="secondary"
									size="sm"
									loading={ busyId === post.id }
									onClick={ () =>
										act( post.id, () => client.retryPost( post.id ) )
									}
								>
									Retry
								</Button>
							) }
							<Button
								variant="ghost"
								size="sm"
								onClick={ () =>
									setOpenId( openId === post.id ? null : post.id )
								}
							>
								{ openId === post.id ? 'Hide status' : 'Status' }
							</Button>
							<Button
								variant="ghost"
								size="sm"
								loading={ busyId === post.id }
								onClick={ () => {
									// eslint-disable-next-line no-alert
									if ( ! window.confirm( 'Delete this post from BulkPublish?' ) ) {
										return;
									}
									act( post.id, () => client.deletePost( post.id ) );
								} }
							>
								Delete
							</Button>
						</div>
						{ openId === post.id && (
							<StatusList client={ client } postId={ post.id } poll={ false } />
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
