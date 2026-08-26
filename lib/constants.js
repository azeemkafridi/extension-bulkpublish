/**
 * Shared constants — mirrored from the BulkPublish API and kept in sync with
 * the WordPress plugin's src/lib/api.js.
 */

export const DEFAULT_BASE_URL = 'https://app.bulkpublish.com';

/** Per-platform character limits, mirrored from the API's PLATFORM_CHAR_LIMITS. */
export const PLATFORM_LIMITS = {
	x: 280,
	twitter: 280,
	threads: 500,
	bluesky: 300,
	mastodon: 500,
	pinterest: 500,
	gmb: 1500,
	linkedin: 3000,
	instagram: 2200,
	tiktok: 2200,
	youtube: 5000,
	facebook: 63206,
};

const LABELS = {
	x: 'X',
	twitter: 'X',
	gmb: 'Google Business',
	youtube: 'YouTube',
	tiktok: 'TikTok',
	linkedin: 'LinkedIn',
};

export function platformLabel( platform ) {
	if ( ! platform ) {
		return '';
	}
	if ( LABELS[ platform ] ) {
		return LABELS[ platform ];
	}
	return platform.charAt( 0 ).toUpperCase() + platform.slice( 1 );
}

/**
 * Team approval state of a post (approvalStatus), orthogonal to `status`.
 * 'pending' and 'rejected' posts are skipped by the scheduler even when
 * scheduled and overdue. Defaults to 'none'.
 */
export const APPROVAL_LABELS = {
	pending: 'Awaiting approval',
	approved: 'Approved',
	rejected: 'Rejected',
};

export const APPROVAL_VARIANTS = {
	pending: 'warning',
	approved: 'success',
	rejected: 'error',
};

/** Label for an approvalStatus, or '' for 'none'/missing (nothing to show). */
export function approvalLabel( approvalStatus ) {
	return APPROVAL_LABELS[ approvalStatus ] || '';
}

/** Simple uploads above this size must go through the multipart flow. */
export const SIMPLE_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

/** Part size for multipart uploads (matches the other integrations). */
export const MULTIPART_PART_BYTES = 10 * 1024 * 1024;
