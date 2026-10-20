import test from 'node:test';
import assert from 'node:assert/strict';
import {
	PLATFORM_POST_TYPES,
	resolvePostTypes,
	validatePlatformMedia,
	validatePlatformOptions,
	validateThread,
} from '../lib/platform-capabilities.js';

test( 'platform post types cover every API platform', () => {
	assert.equal( Object.keys( PLATFORM_POST_TYPES ).length, 15 );
	for ( const platform of [ 'facebook', 'instagram', 'x', 'tiktok', 'youtube', 'threads', 'bluesky', 'pinterest', 'gmb', 'linkedin', 'mastodon', 'discord', 'telegram', 'tumblr', 'snapchat' ] ) {
		assert.ok( PLATFORM_POST_TYPES[ platform ]?.length, platform );
	}
} );

test( 'instagram and pinterest reject text-only default posts', () => {
	const platforms = [ 'instagram', 'pinterest' ];
	const errors = validatePlatformMedia( {
		platforms,
		postTypes: resolvePostTypes( platforms ),
		mediaIds: [],
		mediaItems: {},
	} );
	assert.equal( errors.length, 2 );
	assert.match( errors.join( ' ' ), /Instagram|instagram/i );
	assert.match( errors.join( ' ' ), /Pinterest|pinterest/i );
} );

test( 'facebook and x accept text-only posts', () => {
	const platforms = [ 'facebook', 'x' ];
	assert.deepEqual( validatePlatformMedia( {
		platforms,
		postTypes: resolvePostTypes( platforms ),
		mediaIds: [],
		mediaItems: {},
	} ), [] );
} );

test( 'post type validation catches wrong media kind', () => {
	assert.match( validatePlatformMedia( {
		platforms: [ 'instagram' ],
		postTypes: { instagram: 'feed_photo' },
		mediaIds: [ 1 ],
		mediaItems: { 1: { mimeType: 'video/mp4' } },
	} )[ 0 ], /no videos/ );
} );

test( 'photo slideshows require at least two images', () => {
	const errors = validatePlatformMedia( {
		platforms: [ 'tiktok' ],
		postTypes: { tiktok: 'photo_slideshow' },
		mediaIds: [ 1 ],
		mediaItems: { 1: { mimeType: 'image/jpeg' } },
	} );
	assert.match( errors[ 0 ], /at least 2/ );
} );

test( 'google business rejects known undersized images', () => {
	const errors = validatePlatformMedia( {
		platforms: [ 'gmb' ],
		postTypes: { gmb: 'post' },
		mediaIds: [ 1 ],
		mediaItems: { 1: { mimeType: 'image/jpeg', width: 1200, height: 200 } },
	} );
	assert.match( errors.join( ' ' ), /250 × 250/ );
} );

test( 'required channel options are validated', () => {
	const errors = validatePlatformOptions( {
		channels: [ { channelId: 8, platform: 'discord' } ],
		platformSpecific: {},
	} );
	assert.deepEqual( errors, [
		'Discord: choose a channel.',
	] );
} );

test( 'account media duration limits are validated before submit', () => {
	const errors = validatePlatformOptions( {
		channels: [ { channelId: 7, platform: 'tiktok' }, { channelId: 8, platform: 'snapchat' } ],
		platformSpecific: { tiktok: { privacyLevel: 'PUBLIC_TO_EVERYONE', maxVideoDurationSec: 30 } },
		postTypes: { snapchat: 'spotlight' },
		content: 'Caption',
		mediaIds: [ 1 ],
		mediaItems: { 1: { mimeType: 'video/mp4', duration: 61 } },
	} );
	assert.match( errors.join( ' ' ), /TikTok.*30s/ );
	assert.match( errors.join( ' ' ), /Snapchat.*6–60/ );
} );

test( 'thread mode rejects unsupported channels and blank parts', () => {
	const errors = validateThread( {
		channels: [ { platform: 'instagram' } ],
		parts: [ { content: 'One' }, { content: '' } ],
	} );
	assert.equal( errors.length, 2 );
} );

test( 'thread media uses the strictest selected platform rule', () => {
	const errors = validateThread( {
		channels: [ { platform: 'threads' }, { platform: 'x' } ],
		parts: [
			{ content: 'One', mediaFileIds: [ 1, 2 ] },
			{ content: 'Two' },
		],
		mediaItems: { 1: { mimeType: 'video/mp4' }, 2: { mimeType: 'image/jpeg' } },
	} );
	assert.match( errors.join( ' ' ), /up to 1 media file/ );
	assert.match( errors.join( ' ' ), /images, not video/ );
} );
