/**
 * A card for the page you're on, with click and drag inserts into the caption.
 *
 * Everything shown here was read out of the tab itself by an injected function
 * (see page.js) — the browser that already has the page open does the preview
 * work, so simply opening the composer never asks our server to scrape the URL.
 *
 * The card is entirely optional: dismissing it leaves a plain composer, which
 * is the right shape for a post that has nothing to do with the current tab.
 *
 * The page's image is deliberately not offered here — the media field's
 * one-click "Add page image" action is the single clear place to attach it.
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
							draggable
							onDragStart={ ( event ) => {
								event.dataTransfer.effectAllowed = 'copy';
								event.dataTransfer.setData( 'text/plain', String( value ).trim() );
							} }
							onClick={ () => onInsert( String( value ).trim() ) }
							title={ `Click or drag to insert: ${ String( value ).slice( 0, 140 ) }` }
							aria-label={ `Insert or drag ${ label } into the caption` }
						>
							{ label }
						</button>
					) ) }
				</div>
			) }
		</div>
	);
}
