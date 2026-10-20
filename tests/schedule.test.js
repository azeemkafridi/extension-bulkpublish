import test from 'node:test';
import assert from 'node:assert/strict';
import {
	defaultScheduleAt,
	formatLocalDateTime,
	isFutureSchedule,
	parseLocalDateTime,
	submissionScheduleAt,
} from '../lib/schedule.js';

test( 'local schedule values parse and format without changing wall time', () => {
	const value = '2026-09-01T14:35';
	assert.equal( formatLocalDateTime( parseLocalDateTime( value ) ), value );
	assert.equal( parseLocalDateTime( '2026-02-30T10:00' ), null );
} );

test( 'default schedule is rounded up and safely in the future', () => {
	const now = new Date( 2026, 8, 1, 10, 1, 30 );
	assert.equal( defaultScheduleAt( now ), '2026-09-01T10:10' );
	assert.ok( isFutureSchedule( defaultScheduleAt( now ), now ) );
} );

test( 'schedule validation rejects empty, invalid, and elapsed values', () => {
	const now = new Date( 2026, 8, 1, 10, 0, 30 );
	assert.equal( isFutureSchedule( '', now ), false );
	assert.equal( isFutureSchedule( '2026-09-01T10:00', now ), false );
	assert.equal( isFutureSchedule( '2026-09-01T10:01', now ), true );
} );

test( 'publish-now submissions use an immediately due scheduled timestamp', () => {
	const now = new Date( '2026-09-01T05:00:00.000Z' );
	assert.equal( submissionScheduleAt( 'now', '', now ), now.toISOString() );
	assert.equal(
		submissionScheduleAt( 'schedule', '2026-09-01T10:15', now ),
		parseLocalDateTime( '2026-09-01T10:15' ).toISOString()
	);
} );
