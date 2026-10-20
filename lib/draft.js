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

const hasThreadContent = ( parts ) =>
	( parts || [] ).some( ( part ) =>
		( part.content || '' ).trim() || ( part.mediaFileIds || [] ).length
	);

const hasPlatformOptions = ( value ) =>
	value && Object.keys( value ).length > 0;

/** Anything in this draft worth restoring instead of a fresh page prefill? */
export function hasContent( d ) {
	return !! (
		d &&
		( ( d.caption || '' ).trim() ||
			( d.mediaIds || [] ).length ||
			d.scheduleAt ||
			hasOverride( d.perChannel ) ||
			hasThreadContent( d.threadParts ) ||
			( d.firstComment || '' ).trim() ||
			hasPlatformOptions( d.platformSpecific ) )
	);
}

/** Whether a restored draft describes a different page than the current tab. */
export function isDraftFromAnotherPage( draft, pageUrl ) {
	return !! ( draft?.pageUrl && pageUrl && draft.pageUrl !== pageUrl );
}

/** Restore the page snapshot that belongs to a draft, including legacy drafts. */
export function draftPageContext( draft ) {
	if ( draft?.pageContext?.url === draft?.pageUrl ) {
		return draft.pageContext;
	}
	const url = draft?.pageUrl || '';
	const suffix = url ? `\n\n${ url }` : '';
	const prefill = draft?.prefillCaption || '';
	return {
		title: suffix && prefill.endsWith( suffix )
			? prefill.slice( 0, -suffix.length )
			: '',
		url,
		selectionText: '',
	};
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
		! hasOverride( d.perChannel ) &&
		! hasThreadContent( d.threadParts ) &&
		! ( d.firstComment || '' ).trim() &&
		! hasPlatformOptions( d.platformSpecific )
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
