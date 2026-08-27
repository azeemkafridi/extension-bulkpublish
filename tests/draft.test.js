import test from 'node:test';
import assert from 'node:assert/strict';
import { hasContent, isUntouchedPrefill, shouldRestore } from '../lib/draft.js';

const PAGE_A = 'https://example.com/a';
const PAGE_B = 'https://example.com/b';

/** A draft as written straight after the popup prefilled page A. */
const untouched = ( over = {} ) => ( {
	caption: 'Page A\n\n' + PAGE_A,
	prefillCaption: 'Page A\n\n' + PAGE_A,
	pageUrl: PAGE_A,
	channels: [ 1 ],
	perChannel: {},
	mediaIds: [],
	...over,
} );

test( 'hasContent: empty and blank drafts have nothing', () => {
	assert.equal( hasContent( null ), false );
	assert.equal( hasContent( {} ), false );
	assert.equal( hasContent( { caption: '   ' } ), false );
} );

test( 'hasContent: channels and schedule count as effort too', () => {
	assert.equal( hasContent( { channels: [ 1 ] } ), true );
	assert.equal( hasContent( { scheduleAt: '2026-09-01T10:00' } ), true );
	assert.equal( hasContent( { mediaIds: [ 5 ] } ), true );
	assert.equal( hasContent( { perChannel: { x: 'hi' } } ), true );
	assert.equal( hasContent( { perChannel: { x: '  ' } } ), false );
	assert.equal( hasContent( { pageCardDismissed: true } ), true );
} );

test( 'isUntouchedPrefill: true only when nothing was added', () => {
	assert.equal( isUntouchedPrefill( untouched() ), true );
	assert.equal( isUntouchedPrefill( untouched( { caption: 'my own words' } ) ), false );
	assert.equal( isUntouchedPrefill( untouched( { mediaIds: [ 9 ] } ) ), false );
	assert.equal( isUntouchedPrefill( untouched( { scheduleAt: 'x' } ) ), false );
	assert.equal( isUntouchedPrefill( untouched( { perChannel: { x: 'v' } } ) ), false );
} );

test( 'an untouched prefill does not follow the user to another page', () => {
	// The regression this guards: opening the popup on A then opening it on B
	// used to caption page B with page A's title.
	assert.equal( shouldRestore( untouched(), PAGE_B ), false );
} );

test( 'an untouched prefill is kept on the same page', () => {
	assert.equal( shouldRestore( untouched(), PAGE_A ), true );
} );

test( 'typed words survive a move to a different page', () => {
	assert.equal(
		shouldRestore( untouched( { caption: 'something I wrote' } ), PAGE_B ),
		true
	);
} );

test( 'attached media survives a move to a different page', () => {
	assert.equal( shouldRestore( untouched( { mediaIds: [ 7 ] } ), PAGE_B ), true );
} );

test( 'nothing to restore from an empty or missing draft', () => {
	assert.equal( shouldRestore( null, PAGE_A ), false );
	assert.equal( shouldRestore( {}, PAGE_A ), false );
} );
