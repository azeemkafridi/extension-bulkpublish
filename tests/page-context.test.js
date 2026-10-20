import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile( new URL( '../entrypoints/popup/page.js', import.meta.url ), 'utf8' );
const moduleSource = source.replace( "import { browser } from 'wxt/browser';", 'const browser = globalThis.pageContextBrowser;' );

test( 'capture preserves the live URL despite generic canonical metadata and navigation', async () => {
	const actual = 'https://recent.design/i/xub7uik-film-filter-selector-ui?view=detail#preview';
	globalThis.pageContextBrowser = {
		tabs: { query: async () => [ { id: 1, url: 'https://recent.design/i', title: 'Recent' } ] },
		scripting: { executeScript: async ( { func } ) => [ { result: func() } ] },
	};
	globalThis.location = { href: actual, hostname: 'recent.design' };
	globalThis.window = { getSelection: () => '' };
	globalThis.document = {
		baseURI: actual,
		title: 'Recent',
		querySelector: () => null,
		querySelectorAll: ( selector ) => {
			const values = {
				'meta[property="og:url"]': [ 'https://recent.design/i' ],
				'meta[property="og:title"]': [ '', 'Film filter selector' ],
				'meta[property="og:image"]': [ 'javascript:alert(1)' ],
			}[ selector ] || [];
			return values.map( ( content ) => ( { getAttribute: () => content } ) );
		},
	};
	try {
		const { getPageContext } = await import( `data:text/javascript;base64,${ Buffer.from( moduleSource ).toString( 'base64' ) }` );
		const page = await getPageContext();
		assert.equal( page.url, actual );
		assert.equal( page.tabUrl, actual );
		assert.equal( page.canonical, 'https://recent.design/i' );
		assert.equal( page.title, 'Film filter selector' );
		assert.equal( page.image, '' );
	} finally {
		delete globalThis.pageContextBrowser;
		delete globalThis.location;
		delete globalThis.window;
		delete globalThis.document;
	}
} );
