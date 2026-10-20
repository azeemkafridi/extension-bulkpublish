const pad = ( value ) => String( value ).padStart( 2, '0' );

export function parseLocalDateTime( value ) {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec( value || '' );
	if ( ! match ) {
		return null;
	}
	const [ , year, month, day, hour, minute ] = match;
	const date = new Date(
		Number( year ),
		Number( month ) - 1,
		Number( day ),
		Number( hour ),
		Number( minute )
	);
	if (
		Number.isNaN( date.getTime() ) ||
		date.getFullYear() !== Number( year ) ||
		date.getMonth() !== Number( month ) - 1 ||
		date.getDate() !== Number( day ) ||
		date.getHours() !== Number( hour ) ||
		date.getMinutes() !== Number( minute )
	) {
		return null;
	}
	return date;
}

export function formatLocalDateTime( date ) {
	return `${ date.getFullYear() }-${ pad( date.getMonth() + 1 ) }-${ pad( date.getDate() ) }T${ pad( date.getHours() ) }:${ pad( date.getMinutes() ) }`;
}

/** Default to the next five-minute boundary, always at least five minutes out. */
export function defaultScheduleAt( now = new Date() ) {
	const next = new Date( now.getTime() + 5 * 60 * 1000 );
	next.setSeconds( 0, 0 );
	next.setMinutes( Math.ceil( next.getMinutes() / 5 ) * 5 );
	return formatLocalDateTime( next );
}

export function isFutureSchedule( value, now = new Date() ) {
	const parsed = parseLocalDateTime( value );
	return !! parsed && parsed.getTime() > now.getTime();
}

/** Convert the UI mode into the timestamp expected by POST /api/posts. */
export function submissionScheduleAt( mode, pickedValue, now = new Date() ) {
	return mode === 'schedule'
		? parseLocalDateTime( pickedValue )?.toISOString()
		: now.toISOString();
}
