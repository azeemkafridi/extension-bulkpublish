/**
 * Platform brand icon in a tinted circle — ported from the WP plugin.
 * The SVGs ship in public/platforms/; anything without one (snapchat has no
 * bundled icon yet) degrades to the platform's initial rather than a broken
 * <img>. We deliberately never render channel.profileImage — platform CDN
 * avatars sit behind short-lived signed URLs that 403 later.
 */
import { platformLabel } from '@/lib/constants.js';

const ICONS = [
	'bluesky',
	'discord',
	'facebook',
	'gmb',
	'instagram',
	'linkedin',
	'mastodon',
	'pinterest',
	'reddit',
	'telegram',
	'threads',
	'tiktok',
	'tumblr',
	'x',
	'youtube',
];

export function PlatformMark( { platform, size } ) {
	const key = String( platform || '' ).toLowerCase();
	const label = platformLabel( key );

	if ( ! key || ! ICONS.includes( key ) ) {
		return <span className="bp-chip-mark">{ label.charAt( 0 ) }</span>;
	}

	return (
		<span
			className={ `bp-platform-icon${ size === 'md' ? ' bp-platform-icon-md' : '' }` }
			data-platform={ key }
		>
			<img src={ `/platforms/${ key }.svg` } alt={ label } width={ 14 } height={ 14 } />
		</span>
	);
}
