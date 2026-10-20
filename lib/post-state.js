import { formatLocalDateTime } from './schedule.js';

function mediaItem( file ) {
	const mimeType = file.mimeType || '';
	return {
		url: file.thumbnailUrl || file.previewUrl || file.largeUrl || file.originalUrl || null,
		type: mimeType.startsWith( 'video/' ) ? 'video' : 'image',
		mimeType,
		width: file.width,
		height: file.height,
		duration: file.duration,
		name: file.fileName || 'media',
	};
}

/** Convert a full GET /api/posts/:id response into durable Composer state. */
export function composerStateFromPost( post, { duplicate = false } = {} ) {
	const media = [ ...( post.mediaFiles || [] ), ...( post.threadMediaFiles || [] ) ]
		.filter( ( file, index, all ) => file && file.id && all.findIndex( ( candidate ) => candidate?.id === file.id ) === index );
	const mediaItems = Object.fromEntries( media.map( ( file ) => [ file.id, mediaItem( file ) ] ) );
	const platformSpecific = { ...( post.platformSpecific || {} ) };
	const firstComment = platformSpecific._firstComment || '';
	delete platformSpecific._firstComment;
	const scheduled = ! duplicate && post.status === 'scheduled' && !! post.scheduledAt;

	return {
		caption: post.content || '',
		channels: [ ...new Set( ( post.postPlatforms || [] ).map( ( row ) => row.channelId ).filter( Boolean ) ) ],
		perChannel: post.platformContent || {},
		mediaIds: post.postFormat === 'thread' ? [] : media.map( ( file ) => file.id ),
		mediaItems,
		postFormat: post.postFormat || 'post',
		postTypeOverrides: post.postTypeOverrides || {},
		platformSpecific,
		threadParts: Array.isArray( post.threadParts ) && post.threadParts.length
			? post.threadParts
			: [ { content: '', mediaFileIds: [] }, { content: '', mediaFileIds: [] } ],
		firstComment,
		requestApproval: ! duplicate && [ 'pending', 'rejected' ].includes( post.approvalStatus ),
		scheduleEnabled: scheduled,
		scheduleAt: scheduled ? formatLocalDateTime( new Date( post.scheduledAt ) ) : '',
		bpPostId: duplicate ? null : post.id,
		editingPostId: duplicate ? null : post.id,
		// Media is already attached to the source post. Detaching it from this
		// composer must never delete the shared server file.
		protectMedia: true,
		pageCardDismissed: true,
		prefillCaption: '',
		pageUrl: '',
		published: false,
		linkTracking: post.linkTrackingOverride === true
			? 'on'
			: post.linkTrackingOverride === false
				? 'off'
				: 'default',
	};
}
