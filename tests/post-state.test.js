import test from 'node:test';
import assert from 'node:assert/strict';
import { composerStateFromPost } from '../lib/post-state.js';

const post = {
	id: 44,
	content: 'Hello',
	status: 'scheduled',
	scheduledAt: '2030-01-02T12:30:00.000Z',
	approvalStatus: 'pending',
	postFormat: 'post',
	postPlatforms: [
		{ id: 1, channelId: 8, platform: 'instagram' },
		{ id: 2, channelId: 9, platform: 'facebook' },
	],
	mediaFiles: [ { id: 7, thumbnailUrl: 'https://cdn.test/thumb.jpg', mimeType: 'image/jpeg' } ],
	platformContent: { instagram: 'IG caption' },
	platformSpecific: { instagram: { locationId: 'x' }, _firstComment: 'First!' },
};

test( 'editable post hydrates the same post and protects attached media', () => {
	const state = composerStateFromPost( post );
	assert.equal( state.editingPostId, 44 );
	assert.equal( state.bpPostId, 44 );
	assert.equal( state.protectMedia, true );
	assert.deepEqual( state.channels, [ 8, 9 ] );
	assert.equal( state.mediaItems[ 7 ].url, 'https://cdn.test/thumb.jpg' );
	assert.equal( state.firstComment, 'First!' );
	assert.equal( state.platformSpecific._firstComment, undefined );
	assert.equal( state.scheduleEnabled, true );
} );

test( 'duplicate is a fresh unscheduled post while retaining safe media references', () => {
	const state = composerStateFromPost( post, { duplicate: true } );
	assert.equal( state.editingPostId, null );
	assert.equal( state.bpPostId, null );
	assert.equal( state.protectMedia, true );
	assert.equal( state.scheduleEnabled, false );
	assert.equal( state.requestApproval, false );
} );

test( 'thread media hydrates previews without becoming top-level post media', () => {
	const state = composerStateFromPost( {
		...post,
		postFormat: 'thread',
		mediaFiles: [],
		threadParts: [
			{ content: 'One', mediaFileIds: [ 21 ] },
			{ content: 'Two', mediaFileIds: [] },
		],
		threadMediaFiles: [ { id: 21, previewUrl: 'https://cdn.test/video.jpg', mimeType: 'video/mp4' } ],
	} );
	assert.deepEqual( state.mediaIds, [] );
	assert.equal( state.mediaItems[ 21 ].type, 'video' );
	assert.equal( state.mediaItems[ 21 ].url, 'https://cdn.test/video.jpg' );
} );

test( 'rejected posts reopen with approval enabled for resubmission', () => {
	const state = composerStateFromPost( { ...post, approvalStatus: 'rejected' } );
	assert.equal( state.requestApproval, true );
} );

test( 'editing preserves an existing per-post link tracking choice', () => {
	assert.equal( composerStateFromPost( { ...post, linkTrackingOverride: true } ).linkTracking, 'on' );
	assert.equal( composerStateFromPost( { ...post, linkTrackingOverride: false } ).linkTracking, 'off' );
	assert.equal( composerStateFromPost( { ...post, linkTrackingOverride: null } ).linkTracking, 'default' );
} );
