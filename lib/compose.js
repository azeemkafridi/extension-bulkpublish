/**
 * Builds the POST /api/posts body from composer state — the extension-side
 * equivalent of the WP plugin's BulkPublish_Publisher::share() payload
 * assembly (which used to run in PHP).
 */

const URL_RE = /https?:\/\/\S+/i;

/**
 * @param {object} opts
 * @param {string}   opts.content              Main caption.
 * @param {Array}    opts.channelIds           Selected channel ids.
 * @param {object}   [opts.perPlatform]        platform → caption override.
 * @param {string[]} [opts.mediaIds]           BulkPublish media file ids.
 * @param {string}   [opts.scheduledAt]        ISO 8601; presence ⇒ status 'scheduled'.
 * @param {string}   [opts.timezone]           IANA timezone.
 * @param {boolean}  [opts.requestApproval]
 * @param {string}   [opts.postFormat]
 * @param {object}   [opts.postTypeOverrides]
 * @param {object}   [opts.platformSpecific]
 * @param {Array}    [opts.threadParts]
 * @param {'default'|'on'|'off'} [opts.linkTracking] Tri-state — 'default'
 *        OMITS linkTrackingOverride entirely (inherit the account setting),
 *        which is deliberately not the same as sending false (force off).
 * @return {object} Body for POST /api/posts.
 */
export function buildPostBody( {
	content,
	channelIds,
	perPlatform,
	mediaIds,
	scheduledAt,
	timezone,
	requestApproval,
	linkTracking,
	postFormat,
	postTypeOverrides,
	platformSpecific,
	threadParts,
	channelEntries,
	forUpdate = false,
} ) {
	const body = {
		content: content || '',
		channels: channelEntries
			? channelEntries.map( ( channel ) => ( { channelId: channel.channelId, platform: channel.platform } ) )
			: ( channelIds || [] ).map( ( channelId ) => ( { channelId } ) ),
		status: scheduledAt ? 'scheduled' : 'draft',
	};
	if ( postFormat ) {
		body.postFormat = postFormat;
	}
	if ( postTypeOverrides && Object.keys( postTypeOverrides ).length ) {
		body.postTypeOverrides = postTypeOverrides;
	}
	if ( platformSpecific && Object.keys( platformSpecific ).length ) {
		body.platformSpecific = platformSpecific;
	}
	if ( postFormat === 'thread' && threadParts && threadParts.length ) {
		body.threadParts = threadParts;
	}
	if ( mediaIds && mediaIds.length ) {
		body.mediaFiles = mediaIds;
	}
	const overrides = {};
	Object.entries( perPlatform || {} ).forEach( ( [ platform, text ] ) => {
		if ( text && text.trim() ) {
			overrides[ platform ] = text;
		}
	} );
	if ( Object.keys( overrides ).length ) {
		body.platformContent = overrides;
	}
	if ( scheduledAt ) {
		body.scheduledAt = scheduledAt;
		body.timezone = timezone || 'UTC';
	}
	if ( requestApproval ) {
		body.requestApproval = true;
	}
	if ( linkTracking === 'on' ) {
		body.linkTrackingOverride = true;
	} else if ( linkTracking === 'off' ) {
		body.linkTrackingOverride = false;
	}
	if ( forUpdate ) {
		// PUT distinguishes “leave unchanged” (missing) from “clear this value”
		// (empty/false/null). The create payload is intentionally sparse, but an
		// editor must send the user's removals explicitly.
		body.mediaFiles = mediaIds || [];
		body.platformContent = overrides;
		body.platformSpecific = platformSpecific || {};
		body.postTypeOverrides = postTypeOverrides || {};
		body.requestApproval = !! requestApproval;
		body.linkTrackingOverride = linkTracking === 'on'
			? true
			: linkTracking === 'off'
				? false
				: null;
		body.threadParts = postFormat === 'thread' ? threadParts || [] : null;
		if ( ! scheduledAt ) {
			body.scheduledAt = null;
		}
	}
	return body;
}

/** True when a URL appears in the caption or any per-platform override. */
export function hasLink( content, perPlatform ) {
	if ( URL_RE.test( content || '' ) ) {
		return true;
	}
	return Object.values( perPlatform || {} ).some( ( t ) =>
		URL_RE.test( t || '' )
	);
}

/**
 * Character-limit check across the selected platforms.
 *
 * @param {object}   opts
 * @param {string[]} opts.platforms   Distinct platforms of selected channels.
 * @param {string}   opts.content     Main caption.
 * @param {object}   [opts.perPlatform]
 * @param {object}   opts.limits      platform → max chars.
 * @return {Array<{platform: string, limit: number, length: number}>}
 */
export function overLimits( { platforms, content, perPlatform, limits } ) {
	const out = [];
	( platforms || [] ).forEach( ( p ) => {
		const text =
			perPlatform && perPlatform[ p ] ? perPlatform[ p ] : content || '';
		const limit = limits[ p ];
		if ( limit && text.length > limit ) {
			out.push( { platform: p, limit, length: text.length } );
		}
	} );
	return out;
}
