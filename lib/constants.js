/**
 * Shared constants — mirrored from the BulkPublish API and kept in sync with
 * the WordPress plugin's src/lib/api.js.
 */

export const DEFAULT_BASE_URL = 'https://app.bulkpublish.com';

/**
 * Per-platform character limits, mirrored from the API's PLATFORM_CHAR_LIMITS
 * (webapp/src/lib/platforms/validation.ts). Keep this list complete: a
 * platform missing here gets no counter and no pre-submit block, so an
 * over-length caption is only caught server-side at publish time.
 */
export const PLATFORM_LIMITS = {
	x: 280,
	// Older channels may still report the pre-rename platform key.
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
	reddit: 40000,
	discord: 2000,
	telegram: 4096,
	// NPF caps a single text block at 4096 chars; the handler splits longer
	// content across blocks, so the practical post ceiling is far higher.
	tumblr: 32768,
	// Spotlight descriptions cap at 160 chars; stories and saved stories take
	// no caption at all, so the caption is only ever used for Spotlight. This
	// is the tightest limit of any platform — tighter than X.
	snapchat: 160,
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
