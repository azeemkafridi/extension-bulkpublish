/**
 * BulkPublish REST client — pure fetch, no browser-extension globals, so it is
 * unit-testable under node:test with an injected fetch.
 *
 * Unlike the WordPress plugin (which proxied through PHP so the key stayed
 * server-side), the extension calls the API directly from the background
 * service worker with `Authorization: Bearer bp_...`.
 */
import { DEFAULT_BASE_URL } from './constants.js';

export class BulkPublishError extends Error {
	/**
	 * @param {string} message Human-readable message.
	 * @param {object} [opts]
	 * @param {string} [opts.code]     API error code (e.g. APPROVAL_REQUIRED).
	 * @param {number} [opts.status]   HTTP status.
	 * @param {string} [opts.bpPostId] Set when a create succeeded but the
	 *                                 follow-up publish failed — lets the UI
	 *                                 offer retry instead of duplicating.
	 * @param {*}      [opts.data]     Raw response body.
	 */
	constructor( message, { code, status, bpPostId, data } = {} ) {
		super( message );
		this.name = 'BulkPublishError';
		this.code = code;
		this.status = status;
		this.bpPostId = bpPostId;
		this.data = data;
	}
}

/**
 * True when the API refused a direct publish/retry because the key's role lacks
 * post:publish — the post must go through approval instead.
 */
export function isApprovalRequired( e ) {
	return !! e && e.code === 'APPROVAL_REQUIRED';
}

/** Pull a human message out of any error shape. */
export function errorMessage( e ) {
	if ( ! e ) {
		return 'Something went wrong.';
	}
	if ( typeof e === 'string' ) {
		return e;
	}
	return e.message || 'Something went wrong.';
}

export class BulkPublishClient {
	/**
	 * @param {object} opts
	 * @param {string} opts.apiKey        bp_… API key.
	 * @param {string} [opts.baseUrl]     Defaults to https://app.bulkpublish.com.
	 * @param {Function} [opts.fetchImpl] Injectable fetch for tests.
	 */
	constructor( { apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl } = {} ) {
		this.apiKey = apiKey;
		this.baseUrl = ( baseUrl || DEFAULT_BASE_URL ).replace( /\/+$/, '' );
		this.fetchImpl = fetchImpl || globalThis.fetch.bind( globalThis );
	}

	/**
	 * Single request chokepoint. Parses JSON, and on status >= 400 throws a
	 * BulkPublishError carrying the API's `{ error: { message, code } }`.
	 */
	async request( path, { method = 'GET', body, formData } = {} ) {
		const headers = {
			Authorization: `Bearer ${ this.apiKey }`,
			Accept: 'application/json',
		};
		const init = { method, headers };
		if ( formData ) {
			// Let fetch set the multipart boundary itself.
			init.body = formData;
		} else if ( body !== undefined ) {
			headers[ 'Content-Type' ] = 'application/json';
			init.body = JSON.stringify( body );
		}
		let res;
		try {
			res = await this.fetchImpl( `${ this.baseUrl }${ path }`, init );
		} catch ( e ) {
			throw new BulkPublishError(
				`Could not reach BulkPublish (${ errorMessage( e ) }). Check your connection.`,
				{ code: 'NETWORK' }
			);
		}
		let data = null;
		try {
			data = await res.json();
		} catch ( e ) {
			// Non-JSON body (proxy error page etc.) — fall through.
		}
		if ( ! res.ok ) {
			// Most endpoints return { error: { message, code } }; the media
			// endpoints return { error: '<string>' }.
			const err = ( data && data.error ) || {};
			const message =
				typeof err === 'string'
					? err
					: err.message || `Request failed with status ${ res.status }`;
			throw new BulkPublishError( message, {
				code: typeof err === 'string' ? undefined : err.code,
				status: res.status,
				data,
			} );
		}
		return data;
	}

	// ── Channels & quotas ────────────────────────────────────────────────

	getChannels() {
		return this.request( '/api/channels' );
	}

	getChannelSets() {
		return this.request( '/api/channel-sets' );
	}

	getQuotaUsage() {
		return this.request( '/api/quotas/usage' );
	}

	getXUsage() {
		return this.request( '/api/quotas/x-usage' );
	}

	// ── Posts ────────────────────────────────────────────────────────────

	createPost( payload ) {
		return this.request( '/api/posts', { method: 'POST', body: payload } );
	}

	listPosts( query = {} ) {
		const qs = new URLSearchParams( query ).toString();
		return this.request( `/api/posts${ qs ? `?${ qs }` : '' }` );
	}

	getPost( id ) {
		return this.request( `/api/posts/${ id }` );
	}

	deletePost( id ) {
		return this.request( `/api/posts/${ id }`, { method: 'DELETE' } );
	}

	publishPost( id ) {
		return this.request( `/api/posts/${ id }/publish`, { method: 'POST' } );
	}

	approvePost( id ) {
		return this.request( `/api/posts/${ id }/approve`, { method: 'POST' } );
	}

	/** Reason is optional, max 2000 chars (enforced server-side). */
	rejectPost( id, reason = '' ) {
		return this.request( `/api/posts/${ id }/reject`, {
			method: 'POST',
			body: reason ? { reason } : {},
		} );
	}

	retryPost( id ) {
		return this.request( `/api/posts/${ id }/retry`, { method: 'POST' } );
	}

	/**
	 * Create-then-publish, matching the WP plugin's Publisher::share flow:
	 * create as draft/scheduled, then publish immediately unless the post came
	 * back held for approval. A publish failure after a successful create
	 * throws a BulkPublishError with bpPostId set so the UI can offer retry
	 * instead of creating a duplicate.
	 */
	async createAndMaybePublish( payload, { publishNow } = {} ) {
		const created = await this.createPost( payload );
		const post = created.post || created;
		if ( ! publishNow || post.approvalStatus === 'pending' ) {
			return post;
		}
		try {
			const published = await this.publishPost( post.id );
			return published.post || published || post;
		} catch ( e ) {
			if ( e instanceof BulkPublishError ) {
				e.bpPostId = post.id;
			}
			throw e;
		}
	}

	// ── Media ────────────────────────────────────────────────────────────

	/**
	 * Simple upload (≤100 MB). `file` is a Blob/File; multipart form field name
	 * is `file`. Returns `{ file: { id, ... } }`.
	 */
	uploadMedia( file, fileName ) {
		const form = new FormData();
		form.append( 'file', file, fileName );
		return this.request( '/api/media', { method: 'POST', formData: form } );
	}

	createMultipartUpload( body ) {
		return this.request( '/api/media/multipart/create', {
			method: 'POST',
			body,
		} );
	}

	completeMultipartUpload( body ) {
		return this.request( '/api/media/multipart/complete', {
			method: 'POST',
			body,
		} );
	}

	abortMultipartUpload( body ) {
		return this.request( '/api/media/multipart/abort', {
			method: 'POST',
			body,
		} );
	}
}
