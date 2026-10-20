/**
 * Browser-composer mirror of the webapp's PostTypeSelector and publish-time
 * media rules. Keep the API enum values exact: these are sent as
 * postTypeOverrides and consumed directly by the platform handlers.
 */

export const THREAD_PLATFORMS = [ 'x', 'threads', 'bluesky', 'mastodon' ];

export const PLATFORM_POST_TYPES = {
	facebook: [
		{ value: 'post', label: 'Post', maxImages: 10, maxVideos: 1 },
		{ value: 'video', label: 'Video', required: true, maxImages: 0, maxVideos: 1 },
		{ value: 'reel', label: 'Reel', required: true, maxImages: 0, maxVideos: 1 },
		{ value: 'story', label: 'Story', required: true, maxImages: 1, maxVideos: 1 },
		{ value: 'carousel', label: 'Carousel', required: true, minMedia: 2, maxImages: 10, maxVideos: 0 },
	],
	instagram: [
		{ value: 'feed_photo', label: 'Feed photo', required: true, maxImages: 1, maxVideos: 0 },
		{ value: 'feed_video', label: 'Feed video', required: true, maxImages: 0, maxVideos: 1 },
		{ value: 'reel', label: 'Reel', required: true, maxImages: 0, maxVideos: 1 },
		{ value: 'story', label: 'Story', required: true, maxImages: 1, maxVideos: 1 },
		{ value: 'carousel', label: 'Carousel', required: true, minMedia: 2, maxMedia: 10, maxImages: 10, maxVideos: 10, allowMixed: true },
	],
	x: [
		{ value: 'tweet', label: 'Post', maxImages: 4, maxVideos: 1 },
		{ value: 'video', label: 'Video', required: true, maxImages: 0, maxVideos: 1 },
	],
	tiktok: [
		{ value: 'video', label: 'Video', required: true, maxImages: 0, maxVideos: 1 },
		{ value: 'photo_slideshow', label: 'Photo slideshow', required: true, minMedia: 2, maxImages: 35, maxVideos: 0 },
	],
	youtube: [
		{ value: 'video', label: 'Video', required: true, minMedia: 1, maxImages: 0, maxVideos: 1 },
		{ value: 'short', label: 'Short', required: true, minMedia: 1, maxImages: 0, maxVideos: 1 },
	],
	threads: [
		{ value: 'text', label: 'Text', maxImages: 0, maxVideos: 0 },
		{ value: 'image', label: 'Image', required: true, maxImages: 1, maxVideos: 0 },
		{ value: 'video', label: 'Video', required: true, maxImages: 0, maxVideos: 1 },
		{ value: 'carousel', label: 'Carousel', required: true, minMedia: 2, maxMedia: 20, maxImages: 20, maxVideos: 20, allowMixed: true },
	],
	bluesky: [
		{ value: 'post', label: 'Post', maxImages: 4, maxVideos: 1 },
		{ value: 'video', label: 'Video', required: true, maxImages: 0, maxVideos: 1 },
	],
	pinterest: [
		{ value: 'pin', label: 'Pin', required: true, minMedia: 1, maxImages: 1, maxVideos: 0 },
		{ value: 'video_pin', label: 'Video pin', required: true, minMedia: 1, maxImages: 0, maxVideos: 1 },
		{ value: 'carousel', label: 'Carousel', required: true, minMedia: 2, maxMedia: 5, maxImages: 5, maxVideos: 0 },
	],
	gmb: [
		{ value: 'post', label: 'Standard post', maxImages: 1, maxVideos: 0 },
		{ value: 'event', label: 'Event', maxImages: 1, maxVideos: 0 },
		{ value: 'offer', label: 'Offer', maxImages: 1, maxVideos: 0 },
	],
	linkedin: [
		{ value: 'post', label: 'Post', maxImages: 1, maxVideos: 1 },
		{ value: 'multi_image', label: 'Gallery', required: true, minMedia: 2, maxImages: 20, maxVideos: 0 },
		{ value: 'pdf_carousel', label: 'PDF carousel', required: true, minMedia: 2, maxImages: 20, maxVideos: 0 },
		{ value: 'article', label: 'Article', maxImages: 1, maxVideos: 0 },
	],
	mastodon: [ { value: 'post', label: 'Post', maxImages: 4, maxVideos: 1 } ],
	discord: [ { value: 'post', label: 'Message', maxMedia: 10, maxImages: 10, maxVideos: 10, allowMixed: true } ],
	telegram: [ { value: 'post', label: 'Post', maxMedia: 10, maxImages: 10, maxVideos: 10, allowMixed: true } ],
	tumblr: [ { value: 'post', label: 'Post', maxMedia: 30, maxImages: 30, maxVideos: 1 } ],
	snapchat: [
		{ value: 'story', label: 'Story', required: true, maxMedia: 1, maxImages: 1, maxVideos: 1 },
		{ value: 'saved_story', label: 'Saved story', required: true, maxMedia: 1, maxImages: 1, maxVideos: 1 },
		{ value: 'spotlight', label: 'Spotlight', required: true, maxMedia: 1, maxImages: 0, maxVideos: 1 },
	],
};

export const PLATFORM_DEFAULTS = {
	facebook: 'post', instagram: 'feed_photo', x: 'tweet', tiktok: 'video',
	youtube: 'video', threads: 'text', bluesky: 'post', pinterest: 'pin',
	gmb: 'post', linkedin: 'post', mastodon: 'post',
	discord: 'post', telegram: 'post', tumblr: 'post', snapchat: 'story',
};

export function resolvePostTypes( platforms, overrides = {}, postFormat = 'post' ) {
	return Object.fromEntries( ( platforms || [] ).map( ( platform ) => [
		platform,
		postFormat === 'thread' ? 'thread' : overrides[ platform ] || PLATFORM_DEFAULTS[ platform ] || 'post',
	] ) );
}

export function mediaKind( item = {} ) {
	const mime = item.mimeType || '';
	if ( mime.startsWith( 'video/' ) || item.type === 'video' ) return 'video';
	if ( mime.startsWith( 'image/' ) || item.type === 'image' ) return 'image';
	return 'unknown';
}

const DISPLAY_NAMES = {
	facebook: 'Facebook', instagram: 'Instagram', x: 'X', tiktok: 'TikTok',
	youtube: 'YouTube', threads: 'Threads', bluesky: 'Bluesky', pinterest: 'Pinterest',
	gmb: 'Google Business', linkedin: 'LinkedIn', mastodon: 'Mastodon',
	discord: 'Discord', telegram: 'Telegram', tumblr: 'Tumblr', snapchat: 'Snapchat',
};

const isHttpUrl = ( value ) => {
	if ( ! value?.trim() ) return true;
	try {
		return [ 'http:', 'https:' ].includes( new URL( value ).protocol );
	} catch ( e ) {
		return false;
	}
};

export function validatePlatformMedia( { platforms, postTypes, mediaIds, mediaItems, postFormat } ) {
	if ( postFormat === 'thread' ) return [];
	const items = ( mediaIds || [] ).map( ( id ) => mediaItems?.[ id ] || {} );
	const images = items.filter( ( item ) => mediaKind( item ) === 'image' ).length;
	const videos = items.filter( ( item ) => mediaKind( item ) === 'video' ).length;
	const errors = [];
	for ( const platform of platforms || [] ) {
		const type = postTypes?.[ platform ] || PLATFORM_DEFAULTS[ platform ];
		const rule = ( PLATFORM_POST_TYPES[ platform ] || [] ).find( ( option ) => option.value === type );
		if ( ! rule ) continue;
		const prefix = `${ DISPLAY_NAMES[ platform ] || platform }: ${ rule.label }`;
		if ( rule.required && ! items.length ) errors.push( `${ prefix } requires media.` );
		if ( rule.minMedia && items.length > 0 && items.length < rule.minMedia ) errors.push( `${ prefix } requires at least ${ rule.minMedia } files.` );
		if ( rule.maxMedia !== undefined && items.length > rule.maxMedia ) errors.push( `${ prefix } supports up to ${ rule.maxMedia } files.` );
		if ( images > rule.maxImages ) errors.push( `${ prefix } supports ${ rule.maxImages ? `up to ${ rule.maxImages } image${ rule.maxImages === 1 ? '' : 's' }` : 'no images' }.` );
		if ( videos > rule.maxVideos ) errors.push( `${ prefix } supports ${ rule.maxVideos ? `up to ${ rule.maxVideos } video${ rule.maxVideos === 1 ? '' : 's' }` : 'no videos' }.` );
		if ( ! rule.allowMixed && images && videos ) errors.push( `${ prefix } cannot mix images and videos.` );
		if ( platform === 'gmb' ) {
			const undersized = items.find( ( item ) => mediaKind( item ) === 'image' && (
				( item.width && item.width < 250 ) || ( item.height && item.height < 250 )
			) );
			if ( undersized ) errors.push( 'Google Business: images must be at least 250 × 250 pixels.' );
		}
	}
	return [ ...new Set( errors ) ];
}

export function validatePlatformOptions( { channels, platformSpecific = {}, postTypes = {}, content = '', mediaIds = [], mediaItems = {} } ) {
	const errors = [];
	const has = ( platform ) => channels.some( ( channel ) => channel.platform === platform );
	const video = mediaIds.map( ( id ) => mediaItems[ id ] || {} ).find( ( item ) => mediaKind( item ) === 'video' );
	const videoDuration = Number( video?.duration ) || null;
	for ( const channel of channels.filter( ( item ) => item.platform === 'discord' ) ) {
		if ( ! platformSpecific.discord?.[ channel.channelId ]?.channelId ) errors.push( 'Discord: choose a channel.' );
	}
	if ( has( 'youtube' ) ) {
		if ( ! platformSpecific.youtube?.title?.trim() ) errors.push( 'YouTube: enter a title.' );
		if ( ! isHttpUrl( platformSpecific.youtube?.thumbnailUrl ) ) errors.push( 'YouTube: enter a valid thumbnail URL.' );
	}
	if ( has( 'pinterest' ) ) {
		const opts = platformSpecific.pinterest || {};
		if ( ! opts.title?.trim() ) errors.push( 'Pinterest: enter a title.' );
		if ( ! isHttpUrl( opts.link ) ) errors.push( 'Pinterest: enter a valid destination URL.' );
		if ( ! isHttpUrl( opts.coverImageUrl ) ) errors.push( 'Pinterest: enter a valid cover image URL.' );
		if ( opts.dominantColor && ! /^#[0-9a-f]{6}$/i.test( opts.dominantColor.trim() ) ) errors.push( 'Pinterest: dominant color must use a 6-digit hex value, such as #FF5733.' );
	}
	if ( has( 'tiktok' ) ) {
		const opts = platformSpecific.tiktok || {};
		if ( ! opts.privacyLevel ) errors.push( 'TikTok: select who can view this post.' );
		if ( ! content.trim() ) errors.push( 'TikTok: enter a caption.' );
		if ( opts.discloseCommercial && ! opts.brandContentToggle && ! opts.brandOrganicToggle ) errors.push( 'TikTok: select a commercial-content disclosure.' );
		if ( opts.brandContentToggle && opts.privacyLevel === 'SELF_ONLY' ) errors.push( 'TikTok: branded content cannot use Only me visibility.' );
		if ( videoDuration && opts.maxVideoDurationSec && videoDuration > opts.maxVideoDurationSec ) errors.push( `TikTok: this video is ${ Math.round( videoDuration ) }s, but this account allows up to ${ opts.maxVideoDurationSec }s.` );
	}
	if ( has( 'gmb' ) ) {
		const opts = platformSpecific.gmb || {};
		if ( opts.ctaType && opts.ctaType !== 'CALL' && ! opts.ctaUrl?.trim() ) errors.push( 'Google Business: enter the CTA URL.' );
		if ( ! isHttpUrl( opts.ctaUrl ) ) errors.push( 'Google Business: enter a valid CTA URL.' );
		if ( ! isHttpUrl( opts.redeemOnlineUrl ) ) errors.push( 'Google Business: enter a valid redemption URL.' );
		if ( [ 'event', 'offer' ].includes( postTypes.gmb ) ) {
			if ( ! opts.eventTitle?.trim() ) errors.push( 'Google Business: enter the event or offer title.' );
			if ( ! opts.startDate || ! opts.endDate ) errors.push( 'Google Business: enter start and end dates.' );
		}
	}
	if ( has( 'snapchat' ) && videoDuration ) {
		const type = postTypes.snapchat || 'story';
		const min = type === 'spotlight' ? 6 : 5;
		if ( videoDuration < min || videoDuration > 60 ) errors.push( `Snapchat: ${ type === 'spotlight' ? 'Spotlight' : 'story' } videos must be ${ min }–60 seconds (this video is ${ Math.round( videoDuration ) }s).` );
	}
	for ( const channel of channels.filter( ( item ) => item.platform === 'tumblr' ) ) {
		if ( ! isHttpUrl( platformSpecific.tumblr?.[ channel.channelId ]?.link ) ) errors.push( 'Tumblr: enter a valid link URL.' );
	}
	return [ ...new Set( errors ) ];
}

export function validateThread( { channels, parts, mediaItems = {}, limits = {} } ) {
	const unsupported = channels.filter( ( channel ) => ! THREAD_PLATFORMS.includes( channel.platform ) );
	const errors = [];
	if ( unsupported.length ) errors.push( 'Threads can only publish to X, Threads, Bluesky, and Mastodon.' );
	if ( ( parts || [] ).length < 2 ) errors.push( 'A thread requires at least two posts.' );
	if ( ( parts || [] ).some( ( part ) => ! part.content?.trim() ) ) errors.push( 'Every thread post needs text.' );
	const activeLimits = channels.map( ( channel ) => limits[ channel.platform ] ).filter( Boolean );
	const limit = activeLimits.length ? Math.min( ...activeLimits ) : null;
	if ( limit && ( parts || [] ).some( ( part ) => ( part.content || '' ).length > limit ) ) errors.push( `Every thread post must be ${ limit } characters or fewer.` );
	const threadRules = { x: { max: 4, video: false }, threads: { max: 1, video: true }, bluesky: { max: 4, video: false }, mastodon: { max: 4, video: false } };
	const activeRules = channels.map( ( channel ) => threadRules[ channel.platform ] ).filter( Boolean );
	const maxMedia = activeRules.length ? Math.min( ...activeRules.map( ( rule ) => rule.max ) ) : 4;
	const videoAllowed = activeRules.length > 0 && activeRules.every( ( rule ) => rule.video );
	for ( const part of parts || [] ) {
		const items = ( part.mediaFileIds || [] ).map( ( id ) => mediaItems[ id ] || {} );
		if ( items.length > maxMedia ) errors.push( `Each thread post supports up to ${ maxMedia } media file${ maxMedia === 1 ? '' : 's' } for the selected channels.` );
		const kinds = new Set( items.map( mediaKind ).filter( ( kind ) => kind !== 'unknown' ) );
		if ( kinds.size > 1 ) errors.push( 'Thread posts cannot mix images and video.' );
		if ( items.filter( ( item ) => mediaKind( item ) === 'video' ).length > 1 ) errors.push( 'Each thread post supports one video.' );
		if ( ! videoAllowed && items.some( ( item ) => mediaKind( item ) === 'video' ) ) errors.push( 'The selected channels support images, not video, in thread posts.' );
	}
	return [ ...new Set( errors ) ];
}
