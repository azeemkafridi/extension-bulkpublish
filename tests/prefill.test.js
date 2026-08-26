import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrefill, resolveTokens } from '../lib/prefill.js';

test( 'page prefill: title + url', () => {
	const { caption } = buildPrefill( {
		title: 'A Post',
		url: 'https://example.com/a',
	} );
	assert.equal( caption, 'A Post\n\nhttps://example.com/a' );
} );

test( 'selection wins over title', () => {
	const { caption } = buildPrefill( {
		title: 'A Post',
		url: 'https://example.com/a',
		selectionText: 'the interesting bit',
	} );
	assert.equal( caption, 'the interesting bit\n\nhttps://example.com/a' );
} );

test( 'image context carries imageUrl through', () => {
	const p = buildPrefill( { url: 'https://x.com', imageUrl: 'https://x.com/i.png' } );
	assert.equal( p.imageUrl, 'https://x.com/i.png' );
} );

test( 'empty everything gives empty caption, null image', () => {
	assert.deepEqual( buildPrefill( {} ), { caption: '', imageUrl: null } );
} );

test( 'resolveTokens expands title and link, keeps unknown tokens', () => {
	assert.equal(
		resolveTokens( 'Read %%title%% at %%link%% by %%author%%', {
			title: 'T',
			url: 'https://u',
		} ),
		'Read T at https://u by %%author%%'
	);
} );
