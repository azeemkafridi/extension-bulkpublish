import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api.js';
import { platformLabel } from '@/lib/constants.js';
import { PlatformMark } from './PlatformMark.jsx';
import { Spinner } from './ui.jsx';

const YOUTUBE_CATEGORIES = [
	[ '22', 'People & Blogs' ], [ '24', 'Entertainment' ], [ '28', 'Science & Technology' ],
	[ '26', 'Howto & Style' ], [ '27', 'Education' ], [ '10', 'Music' ], [ '20', 'Gaming' ],
	[ '17', 'Sports' ], [ '1', 'Film & Animation' ], [ '25', 'News & Politics' ],
	[ '19', 'Travel & Events' ], [ '23', 'Comedy' ], [ '2', 'Autos & Vehicles' ],
	[ '15', 'Pets & Animals' ], [ '29', 'Nonprofits & Activism' ],
];
const X_REPLIES = [
	[ 'everyone', 'Everyone' ], [ 'following', 'Accounts you follow' ],
	[ 'verified', 'Verified accounts' ], [ 'subscribers', 'Your subscribers' ],
	[ 'mentionedUsers', 'Only accounts you mention' ],
];
const GMB_CTAS = [ [ '', 'None' ], [ 'LEARN_MORE', 'Learn more' ], [ 'BOOK', 'Book' ], [ 'ORDER', 'Order' ], [ 'SHOP', 'Shop' ], [ 'SIGN_UP', 'Sign up' ], [ 'CALL', 'Call' ] ];
const TIKTOK_PRIVACY = { PUBLIC_TO_EVERYONE: 'Public', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me' };

const Field = ( { label, required, children, hint } ) => (
	<label className="bp-option-field">
		<span className="bp-option-label">{ label }{ required ? ' *' : '' }</span>
		{ children }
		{ hint && <span className="bp-hint">{ hint }</span> }
	</label>
);

const Input = ( props ) => <input className="bp-input bp-option-input" { ...props } />;
const Select = ( { children, ...props } ) => (
	<div className="bp-override-select-wrap">
		<select className="bp-override-select" { ...props }>{ children }</select>
		<svg className="bp-override-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
	</div>
);
const Check = ( { label, ...props } ) => (
	<label className="bp-option-check"><input type="checkbox" { ...props } /><span>{ label }</span></label>
);

function ChannelOptionsSelect( { client, channel, value, onChange, emptyLabel, itemLabel } ) {
	const [ state, setState ] = useState( { loading: true, items: [], error: '' } );
	useEffect( () => {
		let alive = true;
		setState( { loading: true, items: [], error: '' } );
		client.getChannelOptions( channel.channelId )
			.then( ( data ) => alive && setState( { loading: false, items: data.items || [], error: '' } ) )
			.catch( ( error ) => alive && setState( { loading: false, items: [], error: errorMessage( error ) } ) );
		return () => { alive = false; };
	}, [ client, channel.channelId ] );
	if ( state.loading ) return <Spinner label="Loading options…" />;
	if ( state.error ) return <span className="bp-error-text">{ state.error }</span>;
	return (
		<Select value={ value || '' } onChange={ ( event ) => onChange( event.target.value ) }>
			<option value="">{ emptyLabel }</option>
			{ state.items.map( ( item ) => <option key={ item.id } value={ item.id }>{ itemLabel ? itemLabel( item ) : item.name || item.title }</option> ) }
		</Select>
	);
}

function TikTokOptions( { client, channel, value, onPatch, isPhoto } ) {
	const defaults = { privacyLevel: '', disableDuet: true, disableStitch: true, disableComment: true, isAigc: false, discloseCommercial: false, brandContentToggle: false, brandOrganicToggle: false, autoAddMusic: false };
	const data = { ...defaults, ...value };
	const [ info, setInfo ] = useState( null );
	const [ err, setErr ] = useState( '' );
	useEffect( () => {
		let alive = true;
		client.getChannelOptions( channel.channelId ).then( ( response ) => {
			if ( ! alive ) return;
			setInfo( response.info || null );
			onPatch( { ...defaults, ...value, maxVideoDurationSec: response.info?.maxVideoPostDurationSec } );
		} ).catch( ( error ) => alive && setErr( errorMessage( error ) ) );
		return () => { alive = false; };
	}, [ client, channel.channelId ] );
	if ( err ) return <span className="bp-error-text">{ err }</span>;
	if ( ! info ) return <Spinner label="Loading TikTok account options…" />;
	return (
		<div className="bp-option-stack">
			<span className="bp-muted">Publishing to { info.nickname }</span>
			<Field label="Who can view this post" required><Select value={ data.privacyLevel } onChange={ ( event ) => onPatch( { privacyLevel: event.target.value } ) }><option value="">Select privacy…</option>{ ( info.privacyLevelOptions || [] ).map( ( privacy ) => <option key={ privacy } value={ privacy } disabled={ privacy === 'SELF_ONLY' && data.brandContentToggle }>{ TIKTOK_PRIVACY[ privacy ] || privacy }</option> ) }</Select></Field>
			<Check label="Allow comments" checked={ ! data.disableComment && ! info.commentDisabled } disabled={ info.commentDisabled } onChange={ ( event ) => onPatch( { disableComment: ! event.target.checked } ) } />
			{ ! isPhoto && <><Check label="Allow Duet" checked={ ! data.disableDuet && ! info.duetDisabled } disabled={ info.duetDisabled } onChange={ ( event ) => onPatch( { disableDuet: ! event.target.checked } ) } /><Check label="Allow Stitch" checked={ ! data.disableStitch && ! info.stitchDisabled } disabled={ info.stitchDisabled } onChange={ ( event ) => onPatch( { disableStitch: ! event.target.checked } ) } /></> }
			<Check label="AI-generated content" checked={ !! data.isAigc } onChange={ ( event ) => onPatch( { isAigc: event.target.checked } ) } />
			{ isPhoto && <Check label="Add recommended music" checked={ !! data.autoAddMusic } onChange={ ( event ) => onPatch( { autoAddMusic: event.target.checked } ) } /> }
			<Check label="Disclose commercial content" checked={ !! data.discloseCommercial } onChange={ ( event ) => onPatch( { discloseCommercial: event.target.checked, ...( event.target.checked ? {} : { brandContentToggle: false, brandOrganicToggle: false } ) } ) } />
			{ data.discloseCommercial && <div className="bp-option-indent"><Check label="Your brand" checked={ !! data.brandOrganicToggle } onChange={ ( event ) => onPatch( { brandOrganicToggle: event.target.checked } ) } /><Check label="Branded content" checked={ !! data.brandContentToggle } disabled={ data.privacyLevel === 'SELF_ONLY' } onChange={ ( event ) => onPatch( { brandContentToggle: event.target.checked } ) } /></div> }
			{ ! isPhoto && <Field label="Cover frame timestamp (seconds)"><Input type="number" min="0" step="0.1" value={ data.thumbnailTimestamp ?? '' } onChange={ ( event ) => onPatch( { thumbnailTimestamp: event.target.value ? Number( event.target.value ) : undefined } ) } /></Field> }
			<span className="bp-hint">By posting, you agree to TikTok’s content-sharing and music-usage policies.</span>
		</div>
	);
}

export function PlatformOptions( { client, channels, postTypes, value = {}, onChange } ) {
	if ( ! channels.length ) return null;
	const grouped = Object.groupBy ? Object.groupBy( channels, ( channel ) => channel.platform ) : channels.reduce( ( out, channel ) => ( ( out[ channel.platform ] ||= [] ).push( channel ), out ), {} );
	const visiblePlatforms = Object.keys( grouped ).filter( ( platform ) => ! [ 'linkedin', 'mastodon', 'bluesky', 'telegram' ].includes( platform ) );
	if ( ! visiblePlatforms.length ) return null;
	const patch = ( platform, next ) => onChange( { ...value, [ platform ]: { ...( value[ platform ] || {} ), ...next } } );
	const patchChannel = ( platform, channelId, next ) => patch( platform, { [ channelId ]: { ...( value[ platform ]?.[ channelId ] || {} ), ...next } } );
	return (
		<div className="bp-field bp-platform-options">
			{ visiblePlatforms.map( ( platform ) => {
				const platformChannels = grouped[ platform ];
				const opts = value[ platform ] || {};
				return (
					<details className="bp-option-section" key={ platform } open>
						<summary>
							<PlatformMark platform={ platform } />
							<span>{ platformLabel( platform ) }</span>
							<svg className="bp-option-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
						</summary>
						<div className="bp-option-body">
							{ platform === 'facebook' && <div className="bp-option-stack"><Check label="Also share to Story" checked={ !! opts.shareToStory } onChange={ ( event ) => patch( platform, { shareToStory: event.target.checked } ) } />{ [ 'post', 'reel' ].includes( postTypes.facebook || 'post' ) && <Field label="Video cover URL" hint="Videos and Reels only. Applied a moment after the video goes live; leave blank and Facebook picks a frame."><Input type="url" value={ opts.thumbnailUrl || '' } placeholder="https://example.com/cover.jpg" onChange={ ( event ) => patch( platform, { thumbnailUrl: event.target.value || undefined } ) } /></Field> }</div> }
							{ platform === 'instagram' && <div className="bp-option-stack"><Check label="Also share to Story" checked={ !! opts.shareToStory } onChange={ ( event ) => patch( platform, { shareToStory: event.target.checked } ) } /><Field label="Collaborators" hint="Comma-separated usernames without @."><Input value={ opts.collaborators || '' } placeholder="username1, username2" onChange={ ( event ) => patch( platform, { collaborators: event.target.value } ) } /></Field>{ postTypes.instagram === 'reel' && <><Check label="Trial Reel" checked={ !! opts.trialReel } onChange={ ( event ) => patch( platform, { trialReel: event.target.checked } ) } />{ opts.trialReel && <Field label="Graduation"><Select value={ opts.graduationStrategy || 'manual' } onChange={ ( event ) => patch( platform, { graduationStrategy: event.target.value } ) }><option value="manual">Manual</option><option value="auto">Automatic based on performance</option></Select></Field> }</> }{ [ 'feed_video', 'reel' ].includes( postTypes.instagram ) && <><Field label="Thumbnail timestamp (seconds)"><Input type="number" min="0" step="0.1" value={ opts.thumbnailTimestamp ?? '' } onChange={ ( event ) => patch( platform, { thumbnailTimestamp: event.target.value ? Number( event.target.value ) : undefined } ) } /></Field><Field label="Cover image URL" hint="Set this and the timestamp above is ignored — Instagram takes one or the other."><Input type="url" value={ opts.coverUrl || '' } placeholder="https://example.com/cover.jpg" onChange={ ( event ) => patch( platform, { coverUrl: event.target.value || undefined } ) } /></Field></> }</div> }
							{ platform === 'x' && <Field label="Who can reply"><Select value={ opts.replySettings || 'everyone' } onChange={ ( event ) => patch( platform, { replySettings: event.target.value } ) }>{ X_REPLIES.map( ( [ id, label ] ) => <option key={ id } value={ id }>{ label }</option> ) }</Select></Field> }
							{ platform === 'threads' && <Field label="Quote post ID"><Input value={ opts.quotePostId || '' } placeholder="Threads post ID to quote" onChange={ ( event ) => patch( platform, { quotePostId: event.target.value } ) } /></Field> }
							{ platform === 'pinterest' && <div className="bp-option-stack"><Field label="Title" required><Input maxLength="100" value={ opts.title || '' } onChange={ ( event ) => patch( platform, { title: event.target.value } ) } /></Field><Field label="Destination URL"><Input type="url" value={ opts.link || '' } placeholder="https://example.com" onChange={ ( event ) => patch( platform, { link: event.target.value } ) } /></Field>{ platformChannels.map( ( channel ) => <Field key={ channel.channelId } label={ platformChannels.length > 1 ? `Board — ${ channel.accountName || channel.channelId }` : 'Board' }><ChannelOptionsSelect client={ client } channel={ channel } value={ opts[ channel.channelId ]?.boardId } emptyLabel="Select a board" onChange={ ( boardId ) => patchChannel( platform, channel.channelId, { boardId } ) } /></Field> ) }{ postTypes.pinterest === 'video_pin' && <Field label="Cover image URL" hint="Leave blank to use a video frame."><Input type="url" value={ opts.coverImageUrl || '' } onChange={ ( event ) => patch( platform, { coverImageUrl: event.target.value } ) } /></Field> }<Field label="Dominant color"><Input value={ opts.dominantColor || '' } placeholder="#FF5733" onChange={ ( event ) => patch( platform, { dominantColor: event.target.value } ) } /></Field></div> }
							{ platform === 'youtube' && <div className="bp-option-stack"><Field label="Title" required><Input maxLength="100" value={ opts.title || '' } onChange={ ( event ) => patch( platform, { title: event.target.value } ) } /></Field><Check label="Made for kids" checked={ !! opts.madeForKids } onChange={ ( event ) => patch( platform, { madeForKids: event.target.checked } ) } /><Field label="Visibility"><Select value={ opts.privacyStatus || 'public' } onChange={ ( event ) => patch( platform, { privacyStatus: event.target.value } ) }><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></Select></Field><Field label="Category"><Select value={ opts.categoryId || '22' } onChange={ ( event ) => patch( platform, { categoryId: event.target.value } ) }>{ YOUTUBE_CATEGORIES.map( ( [ id, label ] ) => <option key={ id } value={ id }>{ label }</option> ) }</Select></Field>{ platformChannels.map( ( channel ) => <Field key={ channel.channelId } label="Playlist"><ChannelOptionsSelect client={ client } channel={ channel } value={ opts.playlistId } emptyLabel="No playlist" itemLabel={ ( item ) => item.title || item.name } onChange={ ( playlistId ) => patch( platform, { playlistId } ) } /></Field> ) }<Field label="Thumbnail URL"><Input type="url" value={ opts.thumbnailUrl || '' } onChange={ ( event ) => patch( platform, { thumbnailUrl: event.target.value } ) } /></Field></div> }
							{ platform === 'tiktok' && <TikTokOptions client={ client } channel={ platformChannels[ 0 ] } value={ opts } isPhoto={ postTypes.tiktok === 'photo_slideshow' } onPatch={ ( next ) => patch( platform, next ) } /> }
							{ platform === 'gmb' && <GmbOptions value={ opts } postType={ postTypes.gmb } onPatch={ ( next ) => patch( platform, next ) } /> }
							{ platform === 'discord' && platformChannels.map( ( channel ) => <Field key={ channel.channelId } label={ platformChannels.length > 1 ? `Channel — ${ channel.accountName || channel.channelId }` : 'Channel' } required><ChannelOptionsSelect client={ client } channel={ channel } value={ opts[ channel.channelId ]?.channelId } emptyLabel="Select a channel" itemLabel={ ( item ) => `#${ item.name }` } onChange={ ( channelId ) => patchChannel( platform, channel.channelId, { channelId } ) } /></Field> ) }
							{ platform === 'tumblr' && platformChannels.map( ( channel ) => <div className="bp-option-stack" key={ channel.channelId }><Field label="Blog"><ChannelOptionsSelect client={ client } channel={ channel } value={ opts[ channel.channelId ]?.blogName } emptyLabel="Default blog" itemLabel={ ( item ) => `${ item.title || item.name }${ item.primary ? ' (primary)' : '' }` } onChange={ ( blogName ) => patchChannel( platform, channel.channelId, { blogName } ) } /></Field><Field label="Title"><Input value={ opts[ channel.channelId ]?.title || '' } onChange={ ( event ) => patchChannel( platform, channel.channelId, { title: event.target.value } ) } /></Field><Field label="Tags"><Input value={ ( opts[ channel.channelId ]?.tags || [] ).join( ', ' ) } placeholder="art, design" onChange={ ( event ) => patchChannel( platform, channel.channelId, { tags: event.target.value.split( ',' ).map( ( item ) => item.trim().replace( /^#/, '' ) ).filter( Boolean ) } ) } /></Field><Field label="Link"><Input type="url" value={ opts[ channel.channelId ]?.link || '' } onChange={ ( event ) => patchChannel( platform, channel.channelId, { link: event.target.value } ) } /></Field></div> ) }
							{ platform === 'snapchat' && platformChannels.map( ( channel ) => <SnapchatOptions key={ channel.channelId } postType={ postTypes.snapchat } value={ opts[ channel.channelId ] || {} } onPatch={ ( next ) => patchChannel( platform, channel.channelId, next ) } /> ) }
						</div>
					</details>
				);
			} ) }
		</div>
	);
}

function GmbOptions( { value, postType, onPatch } ) {
	return <div className="bp-option-stack"><Field label="CTA type"><Select value={ value.ctaType || '' } onChange={ ( event ) => onPatch( { ctaType: event.target.value } ) }>{ GMB_CTAS.map( ( [ id, label ] ) => <option key={ id } value={ id }>{ label }</option> ) }</Select></Field>{ value.ctaType && value.ctaType !== 'CALL' && <Field label="CTA URL" required><Input type="url" value={ value.ctaUrl || '' } onChange={ ( event ) => onPatch( { ctaUrl: event.target.value } ) } /></Field> }{ [ 'event', 'offer' ].includes( postType ) && <><Field label={ postType === 'event' ? 'Event title' : 'Offer title' } required><Input value={ value.eventTitle || '' } onChange={ ( event ) => onPatch( { eventTitle: event.target.value } ) } /></Field><div className="bp-option-columns"><Field label="Start date" required><Input type="date" value={ value.startDate || '' } onChange={ ( event ) => onPatch( { startDate: event.target.value } ) } /></Field><Field label="Start time"><Input type="time" value={ value.startTime || '' } onChange={ ( event ) => onPatch( { startTime: event.target.value } ) } /></Field></div><div className="bp-option-columns"><Field label="End date" required><Input type="date" value={ value.endDate || '' } onChange={ ( event ) => onPatch( { endDate: event.target.value } ) } /></Field><Field label="End time"><Input type="time" value={ value.endTime || '' } onChange={ ( event ) => onPatch( { endTime: event.target.value } ) } /></Field></div>{ postType === 'offer' && <><Field label="Coupon code"><Input value={ value.couponCode || '' } onChange={ ( event ) => onPatch( { couponCode: event.target.value } ) } /></Field><Field label="Redeem online URL"><Input type="url" value={ value.redeemOnlineUrl || '' } onChange={ ( event ) => onPatch( { redeemOnlineUrl: event.target.value } ) } /></Field><Field label="Terms and conditions"><textarea className="bp-textarea bp-option-textarea" value={ value.termsConditions || '' } onChange={ ( event ) => onPatch( { termsConditions: event.target.value } ) } /></Field></> }</> }</div>;
}

function SnapchatOptions( { value, postType, onPatch } ) {
	if ( postType === 'saved_story' ) return <Field label="Saved Story title" hint="Maximum 45 characters. The caption is not sent."><Input maxLength="45" value={ value.title || '' } onChange={ ( event ) => onPatch( { title: event.target.value } ) } /></Field>;
	if ( postType === 'spotlight' ) return <div className="bp-option-stack"><Field label="Spotlight locale" hint="The caption becomes the Spotlight description."><Input value={ value.locale || '' } placeholder="en_US" onChange={ ( event ) => onPatch( { locale: event.target.value } ) } /></Field><Check label="Also save to profile" checked={ value.saveToProfile !== false } onChange={ ( event ) => onPatch( { saveToProfile: event.target.checked } ) } /></div>;
	return <span className="bp-hint">Stories publish one image or video for 24 hours. The caption is not sent to Snapchat.</span>;
}
