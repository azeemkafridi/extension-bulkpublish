/**
 * Draft restore rules.
 *
 * A browser popup closes on any click outside it, so losing the composer is
 * the normal way a session ends rather than an edge case — the draft has to
 * survive it. The tension is that we also *prefill* the caption from the page,
 * and a prefill the user never touched must not follow them to another page.
 */

const hasOverride = ( perChannel ) =>
	Object.values( perChannel || {} ).some( ( t ) => ( t || '' ).trim() );

/** Anything in this draft worth restoring instead of a fresh page prefill? */
export function hasContent( d ) {
	return !! (
		d &&
		( ( d.caption || '' ).trim() ||
			( d.mediaIds || [] ).length ||
			( d.channels || [] ).length ||
			d.scheduleAt ||
			d.pageCardDismissed ||
			hasOverride( d.perChannel ) )
	);
}

/**
 * The caption is still exactly what we prefilled and nothing else was added —
 * the popup was opened and closed again.
 */
export function isUntouchedPrefill( d ) {
	return (
		( d.caption || '' ) === ( d.prefillCaption || '' ) &&
		! ( d.mediaIds || [] ).length &&
		! d.scheduleAt &&
		! hasOverride( d.perChannel )
	);
}

/**
 * Should the stored draft be restored, or should we start fresh from the page?
 *
 * @param {object|null} draft   Stored draft, if any.
 * @param {string}      pageUrl URL of the page now open.
 * @return {boolean} True to restore the draft as-is.
 */
export function shouldRestore( draft, pageUrl ) {
	if ( ! draft || ! hasContent( draft ) ) {
		return false;
	}
	// Untouched prefill describing some other page: keeping it would caption
	// this page with the last one's title. Anything the user actually typed or
	// attached is kept regardless of where they are now.
	if ( isUntouchedPrefill( draft ) && draft.pageUrl !== pageUrl ) {
		return false;
	}
	return true;
}
