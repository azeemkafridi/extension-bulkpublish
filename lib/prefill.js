/**
 * Prefill for the composer from the current page / context-menu target, plus
 * the two page tokens that survived the WordPress port. WP resolved a rich
 * token set server-side against the post; in the extension only the current
 * page's title and URL exist, so only %%title%% and %%link%% are supported —
 * unknown tokens are left verbatim, same as the server did.
 */

export const TOKENS = [ 'title', 'link' ];

/**
 * @param {object} opts
 * @param {string} [opts.title]         Page title.
 * @param {string} [opts.url]           Page URL.
 * @param {string} [opts.selectionText] Selected text (context menu).
 * @param {string} [opts.imageUrl]      Right-clicked image (context menu).
 * @return {{caption: string, imageUrl: string|null}}
 */
export function buildPrefill( { title, url, selectionText, imageUrl } = {} ) {
	// A quoted selection reads better than the page title; the URL always
	// trails so the platforms unfurl it.
	const lead = ( selectionText || '' ).trim() || ( title || '' ).trim();
	const caption = [ lead, ( url || '' ).trim() ].filter( Boolean ).join( '\n\n' );
	return { caption, imageUrl: imageUrl || null };
}

/** Expand %%title%% / %%link%% against the current page; unknown tokens stay. */
export function resolveTokens( text, { title, url } = {} ) {
	return ( text || '' ).replace( /%%([a-z_]+)%%/g, ( full, name ) => {
		if ( name === 'title' ) {
			return title || '';
		}
		if ( name === 'link' ) {
			return url || '';
		}
		return full;
	} );
}
