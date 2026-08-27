/**
 * Base UI primitives styled with the .bp- classes from assets/tokens.css —
 * ported from the WordPress plugin's src/components/ui.js (React instead of
 * @wordpress/element, plain strings instead of __()).
 */
import { forwardRef, useState, useRef, useEffect } from 'react';

export const cx = ( ...parts ) => parts.filter( Boolean ).join( ' ' );

export function Button( {
	variant = 'primary',
	size,
	loading = false,
	disabled,
	children,
	className,
	type = 'button',
	...rest
} ) {
	const classes = cx(
		'bp-btn',
		variant && `bp-btn-${ variant }`,
		size && `bp-btn-${ size }`,
		className
	);
	return (
		<button
			type={ type }
			className={ classes }
			disabled={ disabled || loading }
			{ ...rest }
		>
			{ loading && (
				<span
					className="bp-spinner"
					style={ {
						borderColor: 'rgba(255,255,255,0.4)',
						borderTopColor: '#fff',
					} }
				/>
			) }
			{ children }
		</button>
	);
}

export function Card( { children, className, ...rest } ) {
	return (
		<div className={ cx( 'bp-card', className ) } { ...rest }>
			{ children }
		</div>
	);
}

export function TextInput( { className, error, ...rest } ) {
	return (
		<input
			className={ cx( 'bp-input', error && 'bp-has-error', className ) }
			{ ...rest }
		/>
	);
}

export const Textarea = forwardRef( function Textarea(
	{ className, error, ...rest },
	ref
) {
	return (
		<textarea
			ref={ ref }
			className={ cx( 'bp-textarea', error && 'bp-has-error', className ) }
			{ ...rest }
		/>
	);
} );

export function Badge( { variant = 'neutral', children } ) {
	return (
		<span className={ cx( 'bp-badge', `bp-badge-${ variant }` ) }>
			<span className="bp-badge-dot" />
			{ children }
		</span>
	);
}

export function Notice( { type = 'error', children } ) {
	return <div className={ cx( 'bp-alert', `bp-alert-${ type }` ) }>{ children }</div>;
}

export function Toggle( { checked, onChange, label, id } ) {
	return (
		<label className="bp-toggle" htmlFor={ id }>
			<span className="bp-toggle-track" data-on={ checked ? 'true' : 'false' }>
				<span className="bp-toggle-thumb" />
			</span>
			<input
				id={ id }
				type="checkbox"
				className="bp-toggle-input"
				checked={ !! checked }
				onChange={ ( e ) => onChange( e.target.checked ) }
			/>
			<span className="bp-toggle-label">{ label }</span>
		</label>
	);
}

export function Spinner( { label } ) {
	return (
		<div className="bp-loading">
			<span className="bp-spinner" />
			{ label }
		</div>
	);
}

/**
 * Popover menu behind an icon button — used for the section switcher and for
 * per-post actions. Closes on outside click, on Escape, and on any item
 * activation, so callers never manage that themselves.
 */
export function Menu( { icon, label, children, align = 'right' } ) {
	const [ open, setOpen ] = useState( false );
	const ref = useRef( null );

	useEffect( () => {
		if ( ! open ) {
			return;
		}
		const onDown = ( e ) => {
			if ( ref.current && ! ref.current.contains( e.target ) ) {
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

	return (
		<div className="bp-menu" ref={ ref }>
			<button
				type="button"
				className="bp-iconbtn"
				onClick={ () => setOpen( ! open ) }
				aria-haspopup="menu"
				aria-expanded={ open }
				aria-label={ label }
				title={ label }
			>
				{ icon }
			</button>
			{ open && (
				<div
					className="bp-menu-pop"
					data-align={ align }
					role="menu"
					// Any activation inside dismisses the menu.
					onClick={ () => setOpen( false ) }
				>
					{ children }
				</div>
			) }
		</div>
	);
}

export function MenuItem( { children, onClick, active, danger, disabled, after } ) {
	return (
		<button
			type="button"
			role="menuitem"
			disabled={ disabled }
			className={ cx(
				'bp-menu-item',
				active && 'is-active',
				danger && 'is-danger'
			) }
			onClick={ onClick }
		>
			<span>{ children }</span>
			{ after }
		</button>
	);
}

/** Segmented control for small enumerations (link-tracking tri-state). */
export function Segmented( { value, options, onChange, ariaLabel } ) {
	return (
		<div className="bp-segmented" role="radiogroup" aria-label={ ariaLabel }>
			{ options.map( ( o ) => (
				<button
					type="button"
					key={ o.value }
					role="radio"
					aria-checked={ value === o.value }
					className={ cx( 'bp-segment', value === o.value && 'is-active' ) }
					onClick={ () => onChange( o.value ) }
				>
					{ o.label }
				</button>
			) ) }
		</div>
	);
}
