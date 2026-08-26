/**
 * Multipart upload orchestration for files over 100 MB, mirroring the flow the
 * other BulkPublish integrations use:
 *
 *   POST /api/media/multipart/create  { contentType, sizeBytes }
 *     → { r2Key, uploadId, partSize, partUrls, expiresIn }
 *   PUT each part (server-dictated partSize, 10 MB today) to its presigned
 *   URL (NO auth header — presigned)
 *   POST /api/media/multipart/complete { r2Key, uploadId, parts, fileName,
 *                                        mimeType, sizeBytes }
 *   POST /api/media/multipart/abort on any failure.
 *
 * Pure: the client and part-putter are injected, so node:test covers the
 * orchestration without a network.
 */
import { MULTIPART_PART_BYTES } from './constants.js';

/** Split a byte size into sequential parts. */
export function planParts( sizeBytes, partBytes = MULTIPART_PART_BYTES ) {
	if ( ! ( sizeBytes > 0 ) ) {
		return [];
	}
	const parts = [];
	for ( let start = 0, n = 1; start < sizeBytes; start += partBytes, n++ ) {
		parts.push( {
			partNumber: n,
			start,
			end: Math.min( start + partBytes, sizeBytes ),
		} );
	}
	return parts;
}

/**
 * Run the full create → PUT parts → complete flow; aborts server-side on any
 * failure and rethrows the original error.
 *
 * @param {object}   opts
 * @param {object}   opts.client     BulkPublishClient (create/complete/abort).
 * @param {object}   opts.file       { name, type, size }.
 * @param {Function} opts.getPart    (start, end) → Promise<Blob|Buffer> slice.
 * @param {Function} opts.putPart    (url, body) → Promise<{etag: string}>.
 * @param {Function} [opts.onProgress] ({partsDone, partsTotal}) per part.
 * @return {Promise<object>} The complete-call response (uploaded file record).
 */
export async function multipartUpload( {
	client,
	file,
	getPart,
	putPart,
	onProgress,
} ) {
	const created = await client.createMultipartUpload( {
		contentType: file.type,
		sizeBytes: file.size,
	} );
	const { r2Key, uploadId } = created;
	const urls = created.partUrls || [];
	// The server dictates the part size its presigned URLs were made for.
	const plan = planParts( file.size, created.partSize || MULTIPART_PART_BYTES );
	try {
		const parts = [];
		for ( const p of plan ) {
			const body = await getPart( p.start, p.end );
			const { etag } = await putPart( urls[ p.partNumber - 1 ], body );
			parts.push( { partNumber: p.partNumber, etag } );
			if ( onProgress ) {
				onProgress( { partsDone: parts.length, partsTotal: plan.length } );
			}
		}
		return await client.completeMultipartUpload( {
			r2Key,
			uploadId,
			parts,
			fileName: file.name,
			mimeType: file.type,
			sizeBytes: file.size,
		} );
	} catch ( e ) {
		try {
			await client.abortMultipartUpload( { r2Key, uploadId } );
		} catch ( abortErr ) {
			// The original failure is the one worth surfacing.
		}
		throw e;
	}
}
