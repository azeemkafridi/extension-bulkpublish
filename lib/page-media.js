/** Build a deduplicated priority list: social-card image first, then page images. */
export function pageImageCandidates( socialImage, pageImages = [] ) {
	const candidates = [ socialImage, ...pageImages.map( ( image ) => image?.src ) ]
		.filter( ( src ) => typeof src === 'string' && /^https?:\/\//i.test( src ) );
	// A broken social image should fall back to the strongest page candidates,
	// without turning one click into dozens of remote import attempts.
	return [ ...new Set( candidates ) ].slice( 0, 4 );
}

/** Only URL-specific import failures may succeed with another image candidate. */
export function canTryAnotherPageImage( error ) {
	return error?.status === 400 && ! [ 'QUOTA_EXCEEDED', 'FEATURE_DISABLED' ].includes( error?.code );
}

/** Translate transport/API details into a page-image-specific explanation. */
export function pageImageError( error ) {
	const message = error?.message || '';
	const uploadHint = 'Choose Add media to upload an image from your device.';

	// A non-JSON 404 means /api/media/import itself is absent. A remote image
	// returning 404 is wrapped by that endpoint as a JSON 400 instead.
	if ( error?.status === 404 && /^Request failed with status 404$/i.test( message ) ) {
		// Do not expose a backend rollout mismatch as product copy. This remains
		// actionable for an older/self-hosted server without making the extension
		// sound partially installed.
		return `Couldn’t add this page image automatically. ${ uploadHint }`;
	}
	if ( /fetch failed \(HTTP 404\)/i.test( message ) ) {
		return `No usable page image was found. The image address advertised by this page no longer exists (404). ${ uploadHint }`;
	}
	if ( /host is not allowed|only HTTP\/HTTPS URLs are allowed/i.test( message ) ) {
		return `The image advertised by this page is not publicly accessible. ${ uploadHint }`;
	}
	if ( /unsupported media type|file contents do not match/i.test( message ) ) {
		return `The page image is not in a supported image format. ${ uploadHint }`;
	}
	if ( error?.code === 'NETWORK' ) {
		return `BulkPublish could not be reached to import the page image. Check your connection and try again.`;
	}
	if ( error?.code === 'QUOTA_EXCEEDED' || error?.code === 'FEATURE_DISABLED' ) {
		return message || 'Your BulkPublish plan cannot add this image.';
	}
	return `BulkPublish could not add the image advertised by this page${ message ? `: ${ message }` : '.' } ${ uploadHint }`;
}
