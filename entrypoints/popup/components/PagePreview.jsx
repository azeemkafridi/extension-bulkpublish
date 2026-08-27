/**
 * A card for the page you're on, with one-tap inserts into the caption.
 *
 * Everything shown here was read out of the tab itself by an injected function
 * (see page.js) — the browser that already has the page open does the work, so
 * no URL is ever handed to our server to fetch and scrape.
 *
 * The card is entirely optional: dismissing it leaves a plain composer, which
 * is the right shape for a post that has nothing to do with the current tab.
 */
import { useState } from 'react';
import { errorMessage } from '@/lib/api.js';
import { Notice } from './ui.jsx';

const IconX = () => (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<path d="M18 6L6 18M6 6l12 12" />
	</svg>
);

const IconImage = () => (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<circle cx="8.5" cy="8.5" r="1.5" />
		<path d="M21 15l-5-5L5 21" />
	</svg>
);

export function PagePreview( { page, onInsert, onUseImage, onDismiss } ) {
	const [ busy, setBusy ] = useState( false );
	const [ err, setErr ] = useState( '' );
	const [ usedImage, setUsedImage ] = useState( false );

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

	const useImage = async () => {
		setErr( '' );
		setBusy( true );
		try {
			await onUseImage( page.image );
			setUsedImage( true );
		} catch ( e ) {
			setErr( errorMessage( e ) );
		} finally {
			setBusy( false );
		}
	};

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

			{ ( inserts.length > 0 || page.image ) && (
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
					{ page.image && (
						<button
							type="button"
							className="bp-chip"
							onClick={ useImage }
							disabled={ busy || usedImage }
						>
							<IconImage />
							{ usedImage ? 'Image added' : busy ? 'Adding…' : 'Image' }
						</button>
					) }
				</div>
			) }

			{ err && <Notice type="error">{ err }</Notice> }
		</div>
	);
}
