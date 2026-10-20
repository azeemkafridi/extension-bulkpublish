/**
 * Pre-publish cost & quota table — ported from the WP plugin's CostTable.js
 * with the math extracted to lib/cost.js. Shows what this post will cost and
 * where the account stands BEFORE the user hits Publish/Schedule.
 */
import { useState, useEffect } from 'react';
import { platformLabel } from '@/lib/constants.js';
import { xPostCost, dollars, includesX, fmtLimit } from '@/lib/cost.js';
import { IS_SAFARI } from '@/lib/store-copy.js';

/**
 * @param {object} props
 * @param {Function} props.getQuota Combined fetcher returning
 *        { usage: <GET /api/quotas/usage>, x: <GET /api/quotas/x-usage> }.
 */
export function CostTable( { platforms, hasLink, mediaCount, getQuota } ) {
	const [ data, setData ] = useState( null );
	const [ failed, setFailed ] = useState( false );

	useEffect( () => {
		let alive = true;
		getQuota()
			.then( ( r ) => alive && setData( r ) )
			.catch( () => alive && setFailed( true ) );
		return () => {
			alive = false;
		};
	}, [ getQuota ] );

	if ( failed || ! platforms || platforms.length === 0 ) {
		return null;
	}

	const usage = data && data.usage ? data.usage.usage || {} : {};
	const limits = data && data.usage ? data.usage.limits || {} : {};
	const costs = data && data.x ? data.x.costs : undefined;
	const xBalance =
		data && data.x && data.x.credits ? data.x.credits.balanceDcents : null;

	const hasX = includesX( platforms );
	const xCost = xPostCost( { platforms, hasLink, mediaCount, costs } );

	return (
		<div className="bp-cost">
			<div className="bp-cost-title">Before you publish</div>
			<table className="bp-cost-table">
				<tbody>
					{ /* App Store build: no prices or credit balances (see lib/store-copy.js). */ }
					{ ! IS_SAFARI && platforms.map( ( p ) => {
						const isX = p === 'x' || p === 'twitter';
						return (
							<tr key={ p }>
								<td>{ platformLabel( p ) }</td>
								<td>
									{ isX ? (
										<>
											<strong>{ dollars( xCost ) }</strong>{ ' ' }
											{ hasLink && (
												<span
													className="bp-cost-flag"
													title="Posts containing a link cost more than plain text on X."
												>
													link pricing
												</span>
											) }
										</>
									) : (
										<span className="bp-muted">included in plan</span>
									) }
								</td>
							</tr>
						);
					} ) }
					<tr className={ IS_SAFARI ? undefined : 'bp-cost-sep' }>
						<td>Posts today</td>
						<td>{ fmtLimit( usage.postsToday, limits.postsPerDay ) }</td>
					</tr>
					<tr>
						<td>Posts this month</td>
						<td>{ fmtLimit( usage.postsThisMonth, limits.postsPerMonth ) }</td>
					</tr>
					<tr>
						<td>Media storage</td>
						<td>
							{ fmtLimit( usage.mediaStorageMB, limits.mediaStorageMB ) } MB
						</td>
					</tr>
					{ ! IS_SAFARI && hasX && xBalance != null && (
						<tr>
							<td>X credit balance</td>
							<td>
								<strong>{ dollars( xBalance ) }</strong>
								{ xBalance < xCost && (
									<span className="bp-error-text" style={ { marginTop: 0, marginLeft: 6 } }>
										insufficient for this post
									</span>
								) }
							</td>
						</tr>
					) }
				</tbody>
			</table>
		</div>
	);
}
