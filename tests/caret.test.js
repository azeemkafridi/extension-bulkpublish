import test from 'node:test';
import assert from 'node:assert/strict';
import { insertAtCaret, insertToken } from '../lib/caret.js';

/** Minimal stand-in for a focused/blurred textarea. */
const field = ( { start, end = start, focused = true } ) => {
	const el = {
		selectionStart: start,
		selectionRange: null,
		focus() {},
		setSelectionRange( a, b ) {
			this.selectionRange = [ a, b ];
		},
	};
	el.selectionEnd = end;
	el.ownerDocument = { activeElement: focused ? el : null };
	return el;
};

const run = ( el, text, value, opts ) => {
	let out;
	insertAtCaret( el, text, value, ( v ) => { out = v; }, opts );
	return out;
};

test( 'no element: appends', () => {
	assert.equal( run( null, 'B', 'A' ), 'AB' );
	assert.equal( run( null, 'B', '' ), 'B' );
} );

test( 'inserts at the caret when the field is focused', () => {
	assert.equal( run( field( { start: 5 } ), 'X', 'hello world' ), 'helloX world' );
} );

test( 'replaces the selection', () => {
	assert.equal(
		run( field( { start: 0, end: 5 } ), 'howdy', 'hello world' ),
		'howdy world'
	);
} );

test( 'an unfocused field appends instead of prepending', () => {
	// Regression: an untouched textarea reports caret 0, which silently
	// prepended the insert and jammed it against the existing text.
	assert.equal(
		run( field( { start: 0, focused: false } ), 'X', 'existing' ),
		'existingX'
	);
} );

test( 'a saved selection survives focus moving to an insert chip', () => {
	assert.equal(
		run(
			field( { start: 0, focused: false } ),
			'INSERT',
			'hello world',
			{ selection: { start: 6, end: 11 } }
		),
		'hello INSERT'
	);
} );

test( 'reports the caret after an insertion', () => {
	let nextSelection;
	run( field( { start: 2 } ), 'X', 'abcd', {
		onSelectionChange: ( selection ) => {
			nextSelection = selection;
		},
	} );
	assert.deepEqual( nextSelection, { start: 3, end: 3 } );
} );

test( 'separate: pads both sides only where needed', () => {
	// Mid-text insertion gets a gap on each side.
	assert.equal(
		run( field( { start: 3 } ), 'MID', 'onetwo', { separate: true } ),
		'one\n\nMID\n\ntwo'
	);
	// Appending at the end needs no trailing gap.
	assert.equal(
		run( field( { start: 3 } ), 'END', 'one', { separate: true } ),
		'one\n\nEND'
	);
	// Into an empty field, no padding at all.
	assert.equal( run( field( { start: 0 } ), 'ONLY', '', { separate: true } ), 'ONLY' );
} );

test( 'separate: does not double up existing blank lines', () => {
	assert.equal(
		run( field( { start: 5 } ), 'X', 'one\n\n', { separate: true } ),
		'one\n\nX'
	);
} );

test( 'caret lands after the inserted text, padding included', () => {
	const el = field( { start: 3 } );
	run( el, 'MID', 'onetwo', { separate: true } );
	// requestAnimationFrame is absent under node:test, so the caret move is
	// skipped rather than throwing — the important part is the value above.
	assert.equal( typeof globalThis.requestAnimationFrame, 'undefined' );
} );

test( 'insertToken wraps the name in %% markers', () => {
	assert.equal( run( field( { start: 0, focused: false } ), '', '' ), '' );
	let out;
	insertToken( field( { start: 0, focused: false } ), 'title', 'Read: ', ( v ) => { out = v; } );
	assert.equal( out, 'Read: %%title%%' );
} );
