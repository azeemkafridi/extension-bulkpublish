/**
 * A card for the page you're on, with one-tap inserts into the caption.
 *
 * Everything shown here was read out of the tab itself by an injected function
 * (see page.js) — the browser that already has the page open does the work, so
 * no URL is ever handed to our server to fetch and scrape.
 *
 * The card is entirely optional: dismissing it leaves a plain composer, which
 * is the right shape for a post that has nothing to do with the current tab.
 *
 * The page's image is deliberately not offered here — "Grab images from this
 * page" in the media field already covers it, and with a choice of every image
 * on the page rather than just the one in the og: tag.
 */
const IconX = () => (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<path d="M18 6L6 18M6 6l12 12" />
	</svg>
);

export function PagePreview( { page, onInsert, onDismiss } ) {
	if ( ! page || ( ! page.title && ! page.url ) ) {
		return null;
	}

	// Only offer an insert when there is something to insert.
	const inserts = [
		[ 'title', 'Title', page.title ],
		[ 'url', 'Link', page.url ],
		[ 'description', 'Summary', page.description ],
		[ 'selectionText', 'Selection', page.selectionText ],
	].filter( ( [ , , value ] ) => value && String( value ).trim() );

	let host = '';
	try {
		host = new URL( page.url ).hostname.replace( /^www\./, '' );
	} catch ( e ) {
		host = page.siteName || '';
	}

	return (
		<div className="bp-pagecard">
			<button
				type="button"
				className="bp-pagecard-dismiss"
				onClick={ onDismiss }
				title="Hide this page"
				aria-label="Hide this page"
			>
				<IconX />
			</button>

			<div className="bp-pagecard-main">
				{ page.image && (
					<img className="bp-pagecard-hero" src={ page.image } alt="" />
				) }
				<div className="bp-pagecard-text">
					<span className="bp-pagecard-site">
						{ page.favicon && (
							<img src={ page.favicon } alt="" width="12" height="12" />
						) }
						{ page.siteName || host }
					</span>
					<span className="bp-pagecard-title">{ page.title }</span>
					{ page.description && (
						<span className="bp-pagecard-desc">{ page.description }</span>
					) }
				</div>
			</div>

			{ inserts.length > 0 && (
				<div className="bp-pagecard-actions">
					<span className="bp-tokens-label">Insert</span>
					{ inserts.map( ( [ key, label, value ] ) => (
						<button
							type="button"
							key={ key }
							className="bp-chip"
							onClick={ () => onInsert( String( value ).trim() ) }
							title={ String( value ).slice( 0, 140 ) }
						>
							{ label }
						</button>
					) ) }
				</div>
			) }
		</div>
	);
}
