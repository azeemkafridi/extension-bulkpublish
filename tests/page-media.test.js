import test from 'node:test';
import assert from 'node:assert/strict';
import { BulkPublishError } from '../lib/api.js';
import {
	canTryAnotherPageImage,
	pageImageCandidates,
	pageImageError,
} from '../lib/page-media.js';

test( 'page image candidates prefer social metadata and deduplicate page images', () => {
	assert.deepEqual(
		pageImageCandidates( 'https://cdn.example/social.jpg', [
			{ src: 'https://cdn.example/body.jpg' },
			{ src: 'https://cdn.example/social.jpg' },
		] ),
		[ 'https://cdn.example/social.jpg', 'https://cdn.example/body.jpg' ]
	);
} );

test( 'missing import endpoint stays user-facing and actionable', () => {
	const error = new BulkPublishError( 'Request failed with status 404', { status: 404 } );
	assert.equal(
		pageImageError( error ),
		'Couldn’t add this page image automatically. Choose Add media to upload an image from your device.'
	);
	assert.doesNotMatch( pageImageError( error ), /server|endpoint|404/i );
	assert.equal( canTryAnotherPageImage( error ), false );
} );

test( 'a broken advertised image reports that page context and permits fallback', () => {
	const error = new BulkPublishError(
		'Could not import media: fetch failed (HTTP 404)',
		{ status: 400 }
	);
	assert.match( pageImageError( error ), /No usable page image was found/ );
	assert.match( pageImageError( error ), /no longer exists \(404\)/ );
	assert.equal( canTryAnotherPageImage( error ), true );
} );

test( 'quota errors keep the server explanation and do not retry every image', () => {
	const error = new BulkPublishError( 'You have reached your media storage limit.', {
		status: 403,
		code: 'QUOTA_EXCEEDED',
	} );
	assert.equal( pageImageError( error ), error.message );
	assert.equal( canTryAnotherPageImage( error ), false );
} );
