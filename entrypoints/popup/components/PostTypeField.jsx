import { PLATFORM_POST_TYPES, THREAD_PLATFORMS } from '@/lib/platform-capabilities.js';
import { platformLabel } from '@/lib/constants.js';
import { PlatformMark } from './PlatformMark.jsx';

const Chevron = () => (
	<svg className="bp-override-chevron" viewBox="0 0 24 24" aria-hidden="true">
		<path d="m6 9 6 6 6-6" />
	</svg>
);

export function PostTypeField( {
	platforms,
	postFormat,
	postTypes,
	onFormatChange,
	onPostTypeChange,
	mediaErrors = [],
} ) {
	if ( ! platforms.length ) return null;
	const canThread = platforms.every( ( platform ) => THREAD_PLATFORMS.includes( platform ) );
	return (
		<div className="bp-field bp-content-types">
			<div className="bp-label">Content type</div>
			{ canThread && (
			<div className="bp-format-switch" role="group" aria-label="Thread format">
				<button
					type="button"
					className={ postFormat === 'thread' ? 'is-active' : '' }
					aria-pressed={ postFormat === 'thread' }
					onClick={ () => onFormatChange( postFormat === 'thread' ? 'post' : 'thread' ) }
				>
					Thread
				</button>
			</div>
			) }
			{ postFormat !== 'thread' && (
				<div className="bp-posttype-list">
					{ platforms.map( ( platform ) => {
						const options = PLATFORM_POST_TYPES[ platform ] || [];
						return (
							<div className="bp-posttype-row" key={ platform }>
								<div className="bp-posttype-platform">
									<PlatformMark platform={ platform } />
									<span>{ platformLabel( platform ) }</span>
								</div>
								{ options.length > 1 ? (
									<div className="bp-override-select-wrap">
										<select
											className="bp-override-select"
											value={ postTypes[ platform ] || '' }
											onChange={ ( event ) => onPostTypeChange( platform, event.target.value ) }
										>
											{ options.map( ( option ) => (
												<option key={ option.value } value={ option.value }>{ option.label }</option>
											) ) }
										</select>
										<Chevron />
									</div>
								) : (
									<span className="bp-muted">{ options[ 0 ]?.label || 'Post' }</span>
								) }
							</div>
						);
					} ) }
				</div>
			) }
			{ mediaErrors.map( ( error ) => (
				<span className="bp-error-text" key={ error }>{ error }</span>
			) ) }
		</div>
	);
}
