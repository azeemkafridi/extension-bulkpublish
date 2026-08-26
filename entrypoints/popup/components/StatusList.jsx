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
import { Badge, Button, Notice, Spinner } from './ui.jsx';
import { PlatformMark } from './PlatformMark.jsx';

const STATUS_VARIANT = {
	published: 'success',
	publishing: 'info',
	pending: 'neutral',
	scheduled: 'scheduled',
	failed: 'error',
	partial: 'warning',
};

export function StatusList( { client, postId, poll = true } ) {
	const [ post, setPost ] = useState( null );
	const [ err, setErr ] = useState( '' );
	const [ retrying, setRetrying ] = useState( false );
	const [ approving, setApproving ] = useState( false );

	useEffect( () => {
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
				const stillRunning = ( p.postPlatforms || [] ).some(
					( pp ) => pp.status === 'pending' || pp.status === 'publishing'
				);
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
	}, [ client, postId, poll ] );

	const onRetry = async () => {
		setRetrying( true );
		try {
			await client.retryPost( postId );
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
		( pp ) => pp.status === 'failed' || pp.status === 'partial'
	);

	const approval = post.approvalStatus || 'none';

	return (
		<div className="bp-status">
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
					{ approval === 'pending' && (
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
						{ pp.status }
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
					{ pp.errorMessage && (
						<span className="bp-error-text" style={ { marginTop: 0 } }>
							{ pp.errorMessage }
						</span>
					) }
				</div>
			) ) }
			{ anyFailed && (
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
