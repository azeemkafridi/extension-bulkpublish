import { PLATFORM_LIMITS } from '@/lib/constants.js';
import { MediaField } from './MediaField.jsx';

export function ThreadField( { client, channels, parts, mediaItems, pageImage, onChange, onPartMediaChange, onRemoveMedia } ) {
	const limits = channels.map( ( channel ) => PLATFORM_LIMITS[ channel.platform ] ).filter( Boolean );
	const limit = limits.length ? Math.min( ...limits ) : null;
	const update = ( index, patch ) => onChange( parts.map( ( part, i ) => i === index ? { ...part, ...patch } : part ) );
	return (
		<div className="bp-thread-list">
			{ parts.map( ( part, index ) => (
				<div className="bp-thread-part" key={ index }>
					<div className="bp-thread-head">
						<span>Post { index + 1 }</span>
						{ parts.length > 2 && (
							<button type="button" className="bp-linkbtn" onClick={ () => onChange( parts.filter( ( _, i ) => i !== index ) ) }>Remove</button>
						) }
					</div>
					<textarea
						className="bp-textarea"
						value={ part.content || '' }
						onChange={ ( event ) => update( index, { content: event.target.value } ) }
						placeholder={ index === 0 ? 'Start the thread…' : 'Continue the thread…' }
					/>
					{ limit && <span className={ `bp-hint${ ( part.content || '' ).length > limit ? ' bp-thread-over' : '' }` }>{ ( part.content || '' ).length } / { limit }</span> }
					<MediaField
						client={ client }
						ids={ part.mediaFileIds || [] }
						items={ mediaItems }
						pageImage={ pageImage }
						compact
						onChange={ ( ids, items ) => onPartMediaChange( index, ids, items ) }
						onRemove={ onRemoveMedia }
					/>
				</div>
			) ) }
			<button type="button" className="bp-btn bp-btn-secondary bp-btn-sm" onClick={ () => onChange( [ ...parts, { content: '', mediaFileIds: [] } ] ) }>Add another post</button>
		</div>
	);
}
