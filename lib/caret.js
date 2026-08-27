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
 */
export function insertAtCaret( el, text, value, onChange, { separate = false } = {} ) {
	if ( ! el ) {
		onChange( value ? `${ value }${ text }` : text );
		return;
	}
	// An untouched textarea reports a caret at 0, which would silently prepend.
	// Nobody clicking "Insert" on an unfocused field means "at the very start",
	// so fall back to appending.
	const focused = el.ownerDocument && el.ownerDocument.activeElement === el;
	const start = focused ? el.selectionStart ?? value.length : value.length;
	const end = focused ? el.selectionEnd ?? value.length : value.length;

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
	// The value lands on the next render, so move the caret after it.
	if ( typeof requestAnimationFrame === 'function' ) {
		requestAnimationFrame( () => {
			el.focus();
			const at = start + insert.length;
			el.setSelectionRange( at, at );
		} );
	}
}

/** Insert a `%%token%%` placeholder, resolved against the page at send time. */
export function insertToken( el, token, value, onChange ) {
	insertAtCaret( el, `%%${ token }%%`, value, onChange );
}
