/**
 * Per-channel publish status for a BulkPublish post, polled every 4s until no
 * platform is pending/publishing — ported from the WP plugin's StatusList.js,
 * with the client passed in instead of the WP REST proxy.
 */
import { useState, useEffect } from 'react';
import {
	platformLabel,
	approvalLabel,
	APPROVAL_VARIANTS,
} from '@/lib/constants.js';
import { errorMessage, isApprovalRequired } from '@/lib/api.js';
import { storeSafe } from '@/lib/store-copy.js';
import { Badge, Button, Notice, Spinner } from './ui.jsx';
import { PlatformMark } from './PlatformMark.jsx';

const STATUS_VARIANT = {
	published: 'success',
	publishing: 'info',
	processing: 'info',
	pending: 'neutral',
	scheduled: 'scheduled',
	failed: 'error',
	partial: 'warning',
	unconfirmed: 'warning',
};

const STATUS_LABEL = {
	published: 'Published',
	publishing: 'Publishing',
	processing: 'Processing',
	pending: 'Pending',
	scheduled: 'Scheduled',
	failed: 'Failed',
	partial: 'Partially published',
	unconfirmed: 'Unconfirmed',
};

export function StatusList( {
	client,
	postId,
	poll = true,
	previewPost = null,
	showPostActions = true,
	allowPlatformRetry = false,
	onChanged,
	hideSummary = false,
} ) {
	const [ post, setPost ] = useState( previewPost );
	const [ err, setErr ] = useState( '' );
	const [ retrying, setRetrying ] = useState( false );
	const [ approving, setApproving ] = useState( false );
	const [ retryingPlatformId, setRetryingPlatformId ] = useState( null );
	const [ refreshRevision, setRefreshRevision ] = useState( 0 );

	useEffect( () => {
		// Preview mode is deliberately disconnected from the API. Updating the
		// selected fixture only swaps local data; no polling or mutations run.
		if ( previewPost ) {
			setPost( previewPost );
			setErr( '' );
			return undefined;
		}
		let alive = true;
		let timer = null;

		const load = async () => {
			try {
				const p = await client.getPost( postId );
				if ( ! alive ) {
					return;
				}
				setPost( p );
				setErr( '' );
				const stillRunning = [ 'publishing', 'processing' ].includes( p.status ) ||
					( p.postPlatforms || [] ).some( ( pp ) => [ 'publishing', 'processing' ].includes( pp.status ) );
				if ( poll && stillRunning ) {
					timer = setTimeout( load, 4000 );
				}
			} catch ( e ) {
				if ( alive ) {
					setErr( errorMessage( e ) );
				}
			}
		};

		load();
		return () => {
			alive = false;
			if ( timer ) {
				clearTimeout( timer );
			}
		};
	}, [ client, postId, poll, previewPost, refreshRevision ] );

	const retryRequest = async ( options = {} ) => {
		try {
			await client.retryPost( postId, options );
		} catch ( e ) {
			if ( e?.code !== 'UNCONFIRMED_REQUIRES_REPUBLISH' ) throw e;
			// eslint-disable-next-line no-alert
			if ( ! window.confirm( 'BulkPublish could not confirm whether this post went live. Check the account first. Retry anyway? This may create a duplicate.' ) ) return false;
			await client.retryPost( postId, { ...options, republish: true } );
		}
		setRefreshRevision( ( value ) => value + 1 );
		onChanged?.();
		return true;
	};

	const onRetry = async () => {
		setRetrying( true );
		try {
			await retryRequest();
			setErr( '' );
		} catch ( e ) {
			setErr(
				isApprovalRequired( e )
					? 'Your BulkPublish role cannot publish directly — this post has to be approved by a teammate.'
					: errorMessage( e )
			);
		} finally {
			setRetrying( false );
		}
	};

	const onPlatformRetry = async ( postPlatformId ) => {
		setRetryingPlatformId( postPlatformId );
		try {
			await retryRequest( { postPlatformId } );
			setErr( '' );
		} catch ( e ) {
			setErr( errorMessage( e ) );
		} finally {
			setRetryingPlatformId( null );
		}
	};

	// Approve / reject are only accepted for roles with post:approve (owner,
	// admin, approver); anything else comes back as a 403.
	const onApprovalAction = async ( action ) => {
		let reason = '';
		if ( action === 'reject' ) {
			// eslint-disable-next-line no-alert
			const input = window.prompt( 'Reason for rejecting (optional):', '' );
			if ( input === null ) {
				return;
			}
			reason = input;
		}
		setApproving( true );
		try {
			const updated =
				action === 'approve'
					? await client.approvePost( postId )
					: await client.rejectPost( postId, reason );
			setPost( updated );
			setErr( '' );
		} catch ( e ) {
			setErr( errorMessage( e ) );
		} finally {
			setApproving( false );
		}
	};

	if ( err ) {
		return <Notice type="error">{ err }</Notice>;
	}
	if ( ! post ) {
		return <Spinner label="Checking status…" />;
	}

	const platforms = post.postPlatforms || [];
	const anyFailed = platforms.some(
		( pp ) => [ 'failed', 'partial', 'unconfirmed' ].includes( pp.status )
	);
	const publishedCount = platforms.filter( ( pp ) => pp.status === 'published' ).length;
	const runningCount = platforms.filter(
		( pp ) => pp.status === 'pending' || pp.status === 'publishing'
	).length;
	const activelyPublishing = [ 'publishing', 'processing' ].includes( post.status );
	const approval = post.approvalStatus || 'none';
	let summary = null;
	if ( approval === 'pending' ) {
		summary = {
			type: 'warning',
			text: 'Awaiting approval. It will publish once a teammate approves it.',
		};
	} else if ( approval === 'rejected' ) {
		summary = {
			type: 'error',
			text: 'Approval rejected. Review the reason below.',
		};
	} else if ( activelyPublishing && runningCount && anyFailed ) {
		summary = {
			type: 'warning',
			text: `Publishing: ${ publishedCount } of ${ platforms.length } ${ platforms.length === 1 ? 'channel' : 'channels' } published; some channels need attention.`,
		};
	} else if ( anyFailed && publishedCount ) {
		summary = {
			type: 'warning',
			text: `Published to ${ publishedCount } of ${ platforms.length } channels. Review the details below.`,
		};
	} else if ( anyFailed ) {
		summary = {
			type: 'error',
			text: `Publishing failed. Review ${ platforms.length === 1 ? 'the channel' : 'the channels' } below.`,
		};
	} else if ( activelyPublishing && runningCount ) {
		summary = {
			type: 'info',
			text: `Publishing to ${ platforms.length } ${ platforms.length === 1 ? 'channel' : 'channels' }…`,
		};
	} else if ( activelyPublishing ) {
		summary = { type: 'info', text: 'Publishing…' };
	}

	return (
		<div className="bp-status">
			{ ! hideSummary && summary && <Notice type={ summary.type }>{ summary.text }</Notice> }
			{ approval !== 'none' && (
				<div className="bp-status-row">
					<Badge variant={ APPROVAL_VARIANTS[ approval ] || 'neutral' }>
						{ approvalLabel( approval ) }
					</Badge>
					{ approval === 'rejected' && post.rejectionReason && (
						<span className="bp-error-text" style={ { marginTop: 0 } }>
							{ post.rejectionReason }
						</span>
					) }
					{ approval === 'pending' && ! previewPost && showPostActions && (
						<>
							<Button
								variant="secondary"
								size="sm"
								loading={ approving }
								onClick={ () => onApprovalAction( 'approve' ) }
							>
								Approve
							</Button>
							<Button
								variant="ghost"
								size="sm"
								loading={ approving }
								onClick={ () => onApprovalAction( 'reject' ) }
							>
								Reject
							</Button>
						</>
					) }
				</div>
			) }
			{ platforms.map( ( pp ) => (
				<div className="bp-status-row" key={ pp.id || pp.platform }>
					<PlatformMark platform={ pp.platform } />
					<span className="bp-chip-platform">
						{ platformLabel( pp.platform ) }
					</span>
					<Badge variant={ STATUS_VARIANT[ pp.status ] || 'neutral' }>
						{ STATUS_LABEL[ pp.status ] || pp.status }
					</Badge>
					{ pp.platformUrl && (
						<a
							className="bp-link"
							href={ pp.platformUrl }
							target="_blank"
							rel="noopener noreferrer"
						>
							View
						</a>
					) }
					{ allowPlatformRetry && ! previewPost && [ 'failed', 'unconfirmed' ].includes( pp.status ) && (
						<Button
							variant="ghost"
							size="sm"
							loading={ retryingPlatformId === pp.id }
							disabled={ retryingPlatformId !== null }
							onClick={ () => onPlatformRetry( pp.id ) }
						>
							Retry
						</Button>
					) }
					{ pp.errorMessage && (
						<span className="bp-error-text" style={ { marginTop: 0 } }>
							{ storeSafe( pp.errorMessage ) }
						</span>
					) }
				</div>
			) ) }
			{ anyFailed && ! previewPost && showPostActions && (
				<Button
					variant="secondary"
					size="sm"
					loading={ retrying }
					onClick={ onRetry }
				>
					Retry failed
				</Button>
			) }
		</div>
	);
}
