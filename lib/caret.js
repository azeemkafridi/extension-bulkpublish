/**
 * Caret-aware text insertion for the caption field. Pure enough to test: it
 * touches only the properties of the element it is handed.
 */

/**
 * Insert text at the field's caret (replacing any selection).
 *
 * @param {HTMLTextAreaElement|null} el
 * @param {string}   text     Text to insert.
 * @param {string}   value    Current caption.
 * @param {Function} onChange Receives the next caption.
 * @param {object}   [opts]
 * @param {boolean}  [opts.separate] Pad with blank lines so the insertion
 *                                   reads as its own paragraph.
 * @param {{start: number, end: number}|null} [opts.selection] Last known
 *                                   selection, used after the field blurs.
 * @param {Function} [opts.onSelectionChange] Receives the caret position
 *                                   immediately after insertion.
 */
export function insertAtCaret(
	el,
	text,
	value,
	onChange,
	{ separate = false, selection = null, onSelectionChange } = {}
) {
	if ( ! el ) {
		onChange( value ? `${ value }${ text }` : text );
		return;
	}
	// An untouched textarea reports a caret at 0, which would silently prepend.
	// Nobody clicking "Insert" on an unfocused field means "at the very start",
	// so fall back to appending.
	const focused = el.ownerDocument && el.ownerDocument.activeElement === el;
	const hasSavedSelection =
		selection && Number.isInteger( selection.start ) && Number.isInteger( selection.end );
	const rawStart = hasSavedSelection
		? selection.start
		: focused
		? el.selectionStart ?? value.length
		: value.length;
	const rawEnd = hasSavedSelection
		? selection.end
		: focused
		? el.selectionEnd ?? value.length
		: value.length;
	const start = Math.max( 0, Math.min( rawStart, value.length ) );
	const end = Math.max( start, Math.min( rawEnd, value.length ) );

	const before = value.slice( 0, start );
	const after = value.slice( end );
	let insert = text;
	if ( separate ) {
		// Pad only the sides that actually need it, so inserting between two
		// paragraphs doesn't fuse them and inserting into blank space doesn't
		// open a gap.
		if ( before && ! /\n\s*$/.test( before ) ) {
			insert = `\n\n${ insert }`;
		}
		if ( after && ! /^\s*\n/.test( after ) ) {
			insert = `${ insert }\n\n`;
		}
	}

	onChange( before + insert + after );
	const at = start + insert.length;
	onSelectionChange?.( { start: at, end: at } );
	// The value lands on the next render, so move the caret after it.
	if ( typeof requestAnimationFrame === 'function' ) {
		requestAnimationFrame( () => {
			el.focus();
			el.setSelectionRange( at, at );
		} );
	}
}

/** Insert a `%%token%%` placeholder, resolved against the page at send time. */
export function insertToken( el, token, value, onChange ) {
	insertAtCaret( el, `%%${ token }%%`, value, onChange );
}
