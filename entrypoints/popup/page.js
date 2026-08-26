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

/** Title, URL, and current selection of the active tab. */
export async function getPageContext() {
	const tab = await getActiveTab();
	if ( ! tab || ! tab.id ) {
		return { title: '', url: '', selectionText: '' };
	}
	let selectionText = '';
	try {
		const [ res ] = await browser.scripting.executeScript( {
			target: { tabId: tab.id },
			func: () => String( window.getSelection() || '' ),
		} );
		selectionText = ( res && res.result ) || '';
	} catch ( e ) {
		// chrome:// pages, the web store, PDFs — no injection allowed. The
		// title/URL prefill still works.
	}
	return { title: tab.title || '', url: tab.url || '', selectionText };
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

/**
 * Fetch an image's bytes from INSIDE the page. The extension itself has no
 * host permission on arbitrary image CDNs, so a popup-side fetch would be
 * CORS-blocked — but the page that is already displaying the image can
 * usually fetch it. Returns { b64, type } or null.
 */
export async function fetchPageImage( src ) {
	const tab = await getActiveTab();
	if ( ! tab || ! tab.id ) {
		return null;
	}
	try {
		const [ res ] = await browser.scripting.executeScript( {
			target: { tabId: tab.id },
			func: async ( url ) => {
				try {
					const r = await fetch( url );
					if ( ! r.ok ) {
						return null;
					}
					const blob = await r.blob();
					if ( blob.size > 20 * 1024 * 1024 ) {
						return null; // structured-clone-unfriendly; keep page grabs small
					}
					const b64 = await new Promise( ( resolve, reject ) => {
						const fr = new FileReader();
						fr.onload = () =>
							resolve( String( fr.result ).split( ',' )[ 1 ] || '' );
						fr.onerror = reject;
						fr.readAsDataURL( blob );
					} );
					return { b64, type: blob.type || 'image/jpeg' };
				} catch ( e ) {
					return null;
				}
			},
			args: [ src ],
		} );
		return ( res && res.result ) || null;
	} catch ( e ) {
		return null;
	}
}

/** Base64 → Blob (counterpart of fetchPageImage). */
export function b64ToBlob( b64, type ) {
	const bin = atob( b64 );
	const bytes = new Uint8Array( bin.length );
	for ( let i = 0; i < bin.length; i++ ) {
		bytes[ i ] = bin.charCodeAt( i );
	}
	return new Blob( [ bytes ], { type } );
}
