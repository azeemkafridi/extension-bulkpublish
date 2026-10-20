/**
 * App Store copy rules for the Safari build.
 *
 * The Safari extension ships inside a Mac App Store app, which may not point
 * people at purchases made outside the store (App Review 3.1.1 / 3.1.3(f)).
 * The API's own messages sometimes end with a way out such as "Upgrade to Pro
 * for a higher limit." — fine on the web, a rejection in the store. Every
 * server-supplied string the popup shows passes through `storeSafe`, which in
 * the Safari build drops any sentence that offers a plan, a price or a
 * purchase, and keeps the rest (what happened, and what limit was hit).
 */

/** True only in the Safari build (WXT inlines BROWSER at build time). */
export const IS_SAFARI =
	typeof import.meta.env !== 'undefined' && import.meta.env.BROWSER === 'safari';

const PURCHASE_PROMPT =
	/\b(upgrade|upgrading|buy|purchase|pricing|billing|subscribe|subscription|top[ -]?up|add[- ]on|checkout)\b|\$\s?\d/i;

/** Remove every sentence that offers a purchase. Pure; exported for tests. */
export function withoutPurchasePrompts( text, fallback = 'This is not available on your current plan.' ) {
	if ( typeof text !== 'string' || ! text ) {
		return text;
	}
	const sentences = text.match( /[^.!?]+[.!?]*\s*/g ) || [ text ];
	const kept = sentences.filter( ( s ) => ! PURCHASE_PROMPT.test( s ) ).join( '' ).trim();
	return kept || fallback;
}

/** Apply the store rules when, and only when, this is the Safari build. */
export function storeSafe( text ) {
	return IS_SAFARI ? withoutPurchasePrompts( text ) : text;
}
