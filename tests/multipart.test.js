import test from 'node:test';
import assert from 'node:assert/strict';
import { planParts, multipartUpload } from '../lib/multipart.js';

const MB = 1024 * 1024;

test( 'planParts splits on 10MB boundaries', () => {
	assert.deepEqual( planParts( 5 * MB ), [ { partNumber: 1, start: 0, end: 5 * MB } ] );
	const parts = planParts( 25 * MB );
	assert.equal( parts.length, 3 );
	assert.deepEqual( parts[ 2 ], { partNumber: 3, start: 20 * MB, end: 25 * MB } );
	assert.deepEqual( planParts( 0 ), [] );
	// Exact multiple: no zero-length trailing part.
	assert.equal( planParts( 20 * MB ).length, 2 );
} );

const makeFakeClient = ( { failComplete } = {} ) => {
	const log = [];
	return {
		log,
		createMultipartUpload: async ( body ) => {
			log.push( [ 'create', body ] );
			return {
				r2Key: 'k',
				uploadId: 'u',
				partSize: 10 * MB,
				partUrls: [ 'https://r2/p1', 'https://r2/p2', 'https://r2/p3' ],
			};
		},
		completeMultipartUpload: async ( body ) => {
			log.push( [ 'complete', body ] );
			if ( failComplete ) {
				throw new Error( 'complete failed' );
			}
			return { file: { id: 'media-1' } };
		},
		abortMultipartUpload: async ( body ) => {
			log.push( [ 'abort', body ] );
			return { success: true };
		},
	};
};

test( 'happy path: create → put parts in order → complete', async () => {
	const client = makeFakeClient();
	const progress = [];
	const res = await multipartUpload( {
		client,
		file: { name: 'v.mp4', type: 'video/mp4', size: 25 * MB },
		getPart: async ( start, end ) => ( { start, end } ),
		putPart: async ( url ) => ( { etag: `etag-${ url.slice( -1 ) }` } ),
		onProgress: ( p ) => progress.push( p ),
	} );
	assert.equal( res.file.id, 'media-1' );
	assert.deepEqual( client.log[ 0 ][ 1 ], { contentType: 'video/mp4', sizeBytes: 25 * MB } );
	const complete = client.log.at( -1 );
	assert.equal( complete[ 0 ], 'complete' );
	assert.deepEqual( complete[ 1 ].parts, [
		{ partNumber: 1, etag: 'etag-1' },
		{ partNumber: 2, etag: 'etag-2' },
		{ partNumber: 3, etag: 'etag-3' },
	] );
	assert.equal( complete[ 1 ].fileName, 'v.mp4' );
	assert.deepEqual( progress.at( -1 ), { partsDone: 3, partsTotal: 3 } );
} );

test( 'a failing part aborts server-side and rethrows the original error', async () => {
	const client = makeFakeClient();
	await assert.rejects(
		multipartUpload( {
			client,
			file: { name: 'v.mp4', type: 'video/mp4', size: 25 * MB },
			getPart: async () => ( {} ),
			putPart: async ( url ) =>
				url.endsWith( 'p2' )
					? Promise.reject( new Error( 'part 2 died' ) )
					: { etag: 'e' },
		} ),
		/part 2 died/
	);
	assert.deepEqual( client.log.at( -1 ), [ 'abort', { r2Key: 'k', uploadId: 'u' } ] );
} );

test( 'complete failure also aborts', async () => {
	const client = makeFakeClient( { failComplete: true } );
	await assert.rejects(
		multipartUpload( {
			client,
			file: { name: 'v.mp4', type: 'video/mp4', size: 5 * MB },
			getPart: async () => ( {} ),
			putPart: async () => ( { etag: 'e' } ),
		} ),
		/complete failed/
	);
	assert.equal( client.log.at( -1 )[ 0 ], 'abort' );
} );
