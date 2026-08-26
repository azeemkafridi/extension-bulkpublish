import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPostBody, hasLink, overLimits } from '../lib/compose.js';
import { PLATFORM_LIMITS } from '../lib/constants.js';

test( 'draft body: minimal shape', () => {
	const body = buildPostBody( { content: 'hi', channelIds: [ 1, 2 ] } );
	assert.deepEqual( body, {
		content: 'hi',
		channels: [ { channelId: 1 }, { channelId: 2 } ],
		status: 'draft',
	} );
} );

test( 'scheduled body carries scheduledAt + timezone', () => {
	const body = buildPostBody( {
		content: 'hi',
		channelIds: [ 1 ],
		scheduledAt: '2026-09-01T10:00:00.000Z',
		timezone: 'Europe/Berlin',
	} );
	assert.equal( body.status, 'scheduled' );
	assert.equal( body.scheduledAt, '2026-09-01T10:00:00.000Z' );
	assert.equal( body.timezone, 'Europe/Berlin' );
} );

test( 'empty per-platform overrides are dropped', () => {
	const body = buildPostBody( {
		content: 'hi',
		channelIds: [ 1 ],
		perPlatform: { x: 'short one', linkedin: '   ' },
	} );
	assert.deepEqual( body.platformContent, { x: 'short one' } );
} );

test( 'media ids only present when non-empty', () => {
	assert.equal( buildPostBody( { content: 'x', channelIds: [], mediaIds: [] } ).mediaFiles, undefined );
	assert.deepEqual(
		buildPostBody( { content: 'x', channelIds: [], mediaIds: [ 'm1' ] } ).mediaFiles,
		[ 'm1' ]
	);
} );

test( 'tri-state linkTracking: default OMITS the field entirely', () => {
	const base = { content: 'x', channelIds: [ 1 ] };
	assert.ok( ! ( 'linkTrackingOverride' in buildPostBody( { ...base, linkTracking: 'default' } ) ) );
	assert.ok( ! ( 'linkTrackingOverride' in buildPostBody( base ) ) );
	assert.equal( buildPostBody( { ...base, linkTracking: 'on' } ).linkTrackingOverride, true );
	assert.equal( buildPostBody( { ...base, linkTracking: 'off' } ).linkTrackingOverride, false );
} );

test( 'requestApproval only sent when true', () => {
	assert.ok( ! ( 'requestApproval' in buildPostBody( { content: 'x', channelIds: [] } ) ) );
	assert.equal(
		buildPostBody( { content: 'x', channelIds: [], requestApproval: true } ).requestApproval,
		true
	);
} );

test( 'hasLink checks caption and overrides', () => {
	assert.ok( hasLink( 'see https://example.com' ) );
	assert.ok( hasLink( 'plain', { x: 'go https://example.com' } ) );
	assert.ok( ! hasLink( 'plain', { x: 'still plain' } ) );
} );

test( 'overLimits flags per-platform effective text', () => {
	const long = 'a'.repeat( 300 );
	const out = overLimits( {
		platforms: [ 'x', 'linkedin' ],
		content: long,
		perPlatform: { linkedin: 'short' },
		limits: PLATFORM_LIMITS,
	} );
	assert.equal( out.length, 1 );
	assert.deepEqual( out[ 0 ], { platform: 'x', limit: 280, length: 300 } );
} );
