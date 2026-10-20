/**
 * Reads from the page the user is on. activeTab (granted by opening the popup
 * or clicking the context menu) + the `scripting` permission make these work
 * without any host permission on the site itself.
 */
import { browser } from 'wxt/browser';

export async function getActiveTab() {
	const [ tab ] = await browser.tabs.query( {
		active: true,
		currentWindow: true,
	} );
	return tab || null;
}

/**
 * Everything the composer knows about the page you're on: title, URL,
 * selection, and the sharing metadata the page already publishes for social
 * cards (og:*, twitter:*, meta description, favicon).
 *
 * All of it is read in the user's own tab by an injected function — the page
 * they already have open does the work. We never hand a URL to the server to
 * fetch and scrape, which would put a crawler in the request path of every
 * popup open and see pages the user's session can reach but ours cannot.
 *
 * One injection returns the lot; splitting it would mean a round trip each.
 */
export async function getPageContext() {
	const tab = await getActiveTab();
	if ( ! tab || ! tab.id ) {
		return { title: '', url: '', selectionText: '' };
	}
	// Keep the actual page URL: sites can advertise a generic or stale canonical.
	const base = {
		title: tab.title || '',
		url: tab.url || '',
		tabUrl: tab.url || '',
		selectionText: '',
	};
	try {
		const [ res ] = await browser.scripting.executeScript( {
			target: { tabId: tab.id },
			func: () => {
				const abs = ( u ) => {
					try {
						const url = u ? new URL( u, document.baseURI ) : null;
						return url && /^https?:$/.test( url.protocol ) ? url.href : '';
					} catch ( e ) {
						return '';
					}
				};
				const meta = ( sel ) => {
					return Array.from( document.querySelectorAll( sel ) )
						.map( ( el ) => ( el.getAttribute( 'content' ) || '' ).trim() )
						.find( Boolean ) || '';
				};
				const first = ( ...vals ) => vals.find( ( v ) => v ) || '';
				const icon = document.querySelector(
					'link[rel~="apple-touch-icon"], link[rel~="icon"], link[rel="shortcut icon"]'
				);
				return {
					url: location.href,
					selectionText: String( window.getSelection() || '' ).trim(),
					title: first(
						meta( 'meta[property="og:title"]' ),
						meta( 'meta[name="twitter:title"]' ),
						document.title
					),
					description: first(
						meta( 'meta[property="og:description"]' ),
						meta( 'meta[name="twitter:description"]' ),
						meta( 'meta[name="description"]' )
					),
					siteName: first(
						meta( 'meta[property="og:site_name"]' ),
						location.hostname.replace( /^www\./, '' )
					),
					image: abs(
						first(
							meta( 'meta[property="og:image:secure_url"]' ),
							meta( 'meta[property="og:image"]' ),
							meta( 'meta[name="twitter:image"]' )
						)
					),
					favicon: abs( icon ? icon.getAttribute( 'href' ) : '/favicon.ico' ),
					canonical: abs(
						first(
							meta( 'meta[property="og:url"]' ),
							( document.querySelector( 'link[rel="canonical"]' ) || {} ).href
						)
					),
				};
			},
		} );
		const r = ( res && res.result ) || {};
		return {
			...base,
			...r,
			// Read the URL with the metadata, in case the tab navigated after query().
			title: r.title || base.title,
			url: r.url || base.url,
			tabUrl: r.url || base.tabUrl,
		};
	} catch ( e ) {
		// chrome:// pages, the Web Store, PDFs, file:// — injection is refused.
		// Title and URL still come from the tab itself, so prefill degrades
		// rather than failing.
		return base;
	}
}

/**
 * Collect candidate images from the active tab — big enough to be content
 * (≥200px on both sides), absolute-URL, deduped, largest first.
 */
export async function collectPageImages() {
	const tab = await getActiveTab();
	if ( ! tab || ! tab.id ) {
		return [];
	}
	try {
		const [ res ] = await browser.scripting.executeScript( {
			target: { tabId: tab.id },
			func: () => {
				const seen = new Set();
				const out = [];
				document.querySelectorAll( 'img' ).forEach( ( img ) => {
					const src = img.currentSrc || img.src;
					if (
						! src ||
						! /^https?:/.test( src ) ||
						seen.has( src ) ||
						img.naturalWidth < 200 ||
						img.naturalHeight < 200
					) {
						return;
					}
					seen.add( src );
					out.push( {
						src,
						width: img.naturalWidth,
						height: img.naturalHeight,
					} );
				} );
				out.sort( ( a, b ) => b.width * b.height - a.width * a.height );
				return out.slice( 0, 24 );
			},
		} );
		return ( res && res.result ) || [];
	} catch ( e ) {
		return [];
	}
}
