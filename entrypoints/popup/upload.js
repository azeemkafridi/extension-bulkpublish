/**
 * Media upload from the popup: simple POST up to 100 MB, multipart above it.
 *
 * This runs in the popup rather than the background worker on purpose — a
 * service worker is torn down after ~30s idle, which a large video upload
 * would outlive, while the popup stays alive as long as it is open.
 */
import { SIMPLE_UPLOAD_MAX_BYTES } from '@/lib/constants.js';
import { multipartUpload } from '@/lib/multipart.js';

/** PUT one part to its presigned URL. Presigned means no auth header. */
async function putPart( url, body ) {
	const res = await fetch( url, { method: 'PUT', body } );
	if ( ! res.ok ) {
		throw new Error( `Part upload failed (${ res.status })` );
	}
	const etag = ( res.headers.get( 'ETag' ) || '' ).replace( /"/g, '' );
	if ( ! etag ) {
		throw new Error( 'Part upload returned no ETag' );
	}
	return { etag };
}

/**
 * Upload a Blob and return the created media file record.
 *
 * @param {object}   client       BulkPublishClient.
 * @param {Blob}     blob
 * @param {string}   name         File name to record.
 * @param {Function} [onProgress] Receives a human-readable status string.
 * @return {Promise<object>} The `file` record ({ id, ... }).
 */
export async function uploadBlob( client, blob, name, onProgress ) {
	const say = ( m ) => onProgress && onProgress( m );
	if ( blob.size > SIMPLE_UPLOAD_MAX_BYTES ) {
		const res = await multipartUpload( {
			client,
			file: { name, type: blob.type, size: blob.size },
			getPart: async ( start, end ) => blob.slice( start, end ),
			putPart,
			onProgress: ( { partsDone, partsTotal } ) =>
				say( `Uploading ${ name }… part ${ partsDone }/${ partsTotal }` ),
		} );
		return res.file;
	}
	say( `Uploading ${ name }…` );
	const res = await client.uploadMedia( blob, name );
	return res.file;
}

/** Extension for a mime type, for naming grabbed images. */
export const extForMime = ( type ) =>
	( ( type || '' ).split( '/' )[ 1 ] || 'jpg' ).split( '+' )[ 0 ];
