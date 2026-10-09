import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_LIMITS, platformLabel, approvalLabel } from '../lib/constants.js';
import { overLimits } from '../lib/compose.js';

/**
 * The API's platform enum (webapp/src/lib/db/schema.ts + platforms/validation.ts).
 * 15 platforms.
 */
const API_PLATFORMS = [
	'x',
	'threads',
	'bluesky',
	'mastodon',
	'pinterest',
	'linkedin',
	'instagram',
	'tiktok',
	'youtube',
	'facebook',
	'gmb',
	'discord',
	'telegram',
	'tumblr',
	'snapchat',
];

test( 'every API platform has a character limit', () => {
	const missing = API_PLATFORMS.filter( ( p ) => ! PLATFORM_LIMITS[ p ] );
	assert.deepEqual(
		missing,
		[],
		`platforms with no limit get no counter and no pre-submit block: ${ missing.join( ', ' ) }`
	);
} );

test( 'limits match the server (spot-check the ones the WP plugin lacked)', () => {
	assert.equal( PLATFORM_LIMITS.snapchat, 160 );
	assert.equal( PLATFORM_LIMITS.telegram, 4096 );
	assert.equal( PLATFORM_LIMITS.discord, 2000 );
	assert.equal( PLATFORM_LIMITS.tumblr, 32768 );
} );

test( 'snapchat is the tightest limit — tighter than X', () => {
	assert.ok( PLATFORM_LIMITS.snapchat < PLATFORM_LIMITS.x );
	const out = overLimits( {
		platforms: [ 'snapchat' ],
		content: 'a'.repeat( 200 ),
		limits: PLATFORM_LIMITS,
	} );
	assert.deepEqual( out, [ { platform: 'snapchat', limit: 160, length: 200 } ] );
} );

test( 'platformLabel capitalises unknown platforms and maps the special cases', () => {
	assert.equal( platformLabel( 'snapchat' ), 'Snapchat' );
	assert.equal( platformLabel( 'x' ), 'X' );
	assert.equal( platformLabel( 'twitter' ), 'X' );
	assert.equal( platformLabel( 'gmb' ), 'Google Business' );
	assert.equal( platformLabel( '' ), '' );
} );

test( 'approvalLabel is empty for none/missing', () => {
	assert.equal( approvalLabel( 'none' ), '' );
	assert.equal( approvalLabel( undefined ), '' );
	assert.equal( approvalLabel( 'pending' ), 'Awaiting approval' );
} );
