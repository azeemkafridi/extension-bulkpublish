/**
 * X credit cost math — extracted from the WP plugin's CostTable.js so the
 * component stays presentational and this stays node:test-able.
 *
 * X is the only platform with per-action credit billing today; a post with a
 * link costs ~13× a plain one. Other platforms are included in the plan and
 * only consume the daily/monthly post quota.
 */

// Fallbacks if the price sheet is unavailable; server values win.
export const DEFAULT_COSTS = {
	tweet_create: 15,
	tweet_create_with_url: 200,
	media_simple_upload: 5,
};

export const dollars = ( dcents ) =>
	'$' + ( dcents / 1000 ).toFixed( dcents % 10 === 0 ? 2 : 3 );

export const includesX = ( platforms ) =>
	( platforms || [] ).includes( 'x' ) || ( platforms || [] ).includes( 'twitter' );

/**
 * Cost of this post in dcents on X, or 0 when X is not targeted.
 *
 * @param {object}   opts
 * @param {string[]} opts.platforms
 * @param {boolean}  opts.hasLink
 * @param {number}   [opts.mediaCount]
 * @param {object}   [opts.costs]    Server price sheet; merged over defaults.
 */
export function xPostCost( { platforms, hasLink, mediaCount = 0, costs } ) {
	if ( ! includesX( platforms ) ) {
		return 0;
	}
	const sheet = { ...DEFAULT_COSTS, ...( costs || {} ) };
	return (
		( hasLink ? sheet.tweet_create_with_url : sheet.tweet_create ) +
		mediaCount * sheet.media_simple_upload
	);
}

export const fmtLimit = ( used, limit ) =>
	limit === -1 || limit == null
		? `${ used ?? '…' } / ∞`
		: `${ used ?? '…' } / ${ limit }`;
