/**
 * Channel selection — ported from the WP plugin (itself a port of the app's
 * ChannelSelector). Selected channels are removable pills; the rest live
 * behind a dropdown popover.
 */
import { useState, useRef, useEffect } from 'react';
import { platformLabel, DEFAULT_BASE_URL } from '@/lib/constants.js';
import { PlatformMark } from './PlatformMark.jsx';

const IconX = () => (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<path d="M18 6L6 18M6 6l12 12" />
	</svg>
);

const IconCheck = () => (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
		<path d="M20 6L9 17l-5-5" />
	</svg>
);

const IconPlus = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<path d="M12 5v14M5 12h14" />
	</svg>
);

const IconChevron = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M6 9l6 6 6-6" />
	</svg>
);

export function ChannelSelector( { channels, sets, selected, onToggle, onApplySet } ) {
	const [ open, setOpen ] = useState( false );
	const rootRef = useRef( null );

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const onDown = ( e ) => {
			if ( rootRef.current && ! rootRef.current.contains( e.target ) ) {
				setOpen( false );
			}
		};
		const onKey = ( e ) => {
			if ( e.key === 'Escape' ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'mousedown', onDown );
		document.addEventListener( 'keydown', onKey );
		return () => {
			document.removeEventListener( 'mousedown', onDown );
			document.removeEventListener( 'keydown', onKey );
		};
	}, [ open ] );

	if ( ! channels || channels.length === 0 ) {
		return (
			<p className="bp-muted">
				No channels connected yet. Connect social accounts in your
				BulkPublish dashboard.
			</p>
		);
	}

	const selectedIds = selected || [];
	const byId = ( id ) => channels.find( ( c ) => c.id === id );
	const selectedChannels = selectedIds.map( byId ).filter( Boolean );

	// A set is a shortcut, not a target: only the channels it names that are
	// actually connected can be selected.
	const usableSets = ( sets || [] ).filter( ( s ) =>
		( s.channelIds || [] ).some( ( id ) => channels.some( ( ch ) => ch.id === id ) )
	);

	return (
		<div className="bp-cs" ref={ rootRef }>
			<div className="bp-cs-row">
				{ selectedChannels.map( ( ch ) => (
					<span className="bp-cs-pill" key={ ch.id }>
						<PlatformMark platform={ ch.platform } />
						<span className="bp-cs-pill-name">
							{ ch.accountName || platformLabel( ch.platform ) }
						</span>
						{ ch.tokenStatus && ch.tokenStatus !== 'valid' && (
							<span
								className="bp-cs-pill-warn"
								title="This channel may need reconnecting"
							/>
						) }
						<button
							type="button"
							className="bp-cs-pill-remove"
							onClick={ () => onToggle( ch.id ) }
							aria-label={ `Remove ${ ch.accountName || platformLabel( ch.platform ) }` }
						>
							<IconX />
						</button>
					</span>
				) ) }

				<button
					type="button"
					className="bp-cs-add"
					onClick={ () => setOpen( ! open ) }
					aria-expanded={ open }
				>
					<IconPlus />
					Select Channels
					<IconChevron />
				</button>
			</div>

			{ open && (
				<div className="bp-cs-pop">
					<div className="bp-cs-head">
						<span className="bp-cs-head-title">Channels</span>
						<span className="bp-cs-head-count">
							{ selectedIds.length } selected
						</span>
					</div>

					{ usableSets.length > 0 && onApplySet && (
						<div className="bp-cs-sets">
							<div className="bp-cs-sets-title">Channel sets</div>
							{ usableSets.map( ( s ) => {
								const ids = ( s.channelIds || [] ).filter( ( id ) =>
									channels.some( ( ch ) => ch.id === id )
								);
								return (
									<button
										type="button"
										key={ `set-${ s.id }` }
										className="bp-cs-set"
										onClick={ () => onApplySet( ids ) }
									>
										<span>{ s.name }</span>
										<span className="bp-cs-item-sub">
											{ ids.length }{ ' ' }
											{ ids.length === 1 ? 'channel' : 'channels' }
										</span>
									</button>
								);
							} ) }
						</div>
					) }

					<div className="bp-cs-list">
						{ channels.map( ( ch ) => {
							const isOn = selectedIds.includes( ch.id );
							const needsReconnect = ch.tokenStatus && ch.tokenStatus !== 'valid';
							return (
								<button
									type="button"
									key={ ch.id }
									className="bp-cs-item"
									aria-pressed={ isOn }
									onClick={ () => onToggle( ch.id ) }
								>
									<span className="bp-cs-item-left">
										<PlatformMark platform={ ch.platform } size="md" />
										<span className="bp-cs-item-text">
											<span className="bp-cs-item-name">
												{ ch.accountName || platformLabel( ch.platform ) }
											</span>
											<span className="bp-cs-item-sub">
												{ needsReconnect
													? 'May need reconnecting'
													: platformLabel( ch.platform ) }
											</span>
										</span>
									</span>
									<span className="bp-cs-check" data-on={ isOn ? 'true' : 'false' }>
										<IconCheck />
									</span>
								</button>
							);
						} ) }
					</div>

					<a
						className="bp-cs-foot"
						href={ `${ DEFAULT_BASE_URL }/channels` }
						target="_blank"
						rel="noopener noreferrer"
					>
						<IconPlus />
						Connect channels
					</a>
				</div>
			) }
		</div>
	);
}
