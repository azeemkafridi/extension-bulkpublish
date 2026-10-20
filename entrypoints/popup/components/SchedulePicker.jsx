import { useEffect, useMemo, useState } from 'react';
import {
	defaultScheduleAt,
	formatLocalDateTime,
	parseLocalDateTime,
} from '@/lib/schedule.js';

const pad = ( value ) => String( value ).padStart( 2, '0' );

const sameDay = ( a, b ) =>
	a.getFullYear() === b.getFullYear() &&
	a.getMonth() === b.getMonth() &&
	a.getDate() === b.getDate();

const weekdayNames = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];

/**
 * A small browser-native-free date picker. Native datetime-local popovers are
 * drawn by Chrome/Firefox and cannot use the extension's orange theme.
 */
export function SchedulePicker( { value, onChange } ) {
	const selected = parseLocalDateTime( value ) || parseLocalDateTime( defaultScheduleAt() );
	const [ view, setView ] = useState( () =>
		new Date( selected.getFullYear(), selected.getMonth(), 1 )
	);

	useEffect( () => {
		const next = parseLocalDateTime( value );
		if ( next ) {
			setView( new Date( next.getFullYear(), next.getMonth(), 1 ) );
		} else {
			onChange( defaultScheduleAt() );
		}
	}, [ value ] );

	const days = useMemo( () => {
		const first = new Date( view.getFullYear(), view.getMonth(), 1 );
		const gridStart = new Date( view.getFullYear(), view.getMonth(), 1 - first.getDay() );
		return Array.from( { length: 42 }, ( _, index ) => {
			const date = new Date( gridStart );
			date.setDate( gridStart.getDate() + index );
			return date;
		} );
	}, [ view ] );

	const chooseDate = ( day ) => {
		const next = new Date( day.getFullYear(), day.getMonth(), day.getDate(), selected.getHours(), selected.getMinutes() );
		onChange( formatLocalDateTime( next ) );
	};

	const chooseTime = ( event ) => {
		const [ hour, minute ] = event.target.value.split( ':' ).map( Number );
		const next = new Date( selected );
		next.setHours( hour, minute, 0, 0 );
		onChange( formatLocalDateTime( next ) );
	};

	const monthLabel = new Intl.DateTimeFormat( undefined, {
		month: 'long',
		year: 'numeric',
	} ).format( view );
	const today = new Date();
	const todayStart = new Date( today.getFullYear(), today.getMonth(), today.getDate() );
	const selectedIsToday = sameDay( selected, today );
	const nextMinute = new Date( today.getTime() + 60 * 1000 );
	const minimumTime = selectedIsToday && sameDay( nextMinute, today )
		? `${ pad( nextMinute.getHours() ) }:${ pad( nextMinute.getMinutes() ) }`
		: undefined;

	return (
		<div className="bp-schedule-picker">
			<div className="bp-calendar-head">
				<button
					type="button"
					className="bp-calendar-nav"
					onClick={ () => setView( new Date( view.getFullYear(), view.getMonth() - 1, 1 ) ) }
					aria-label="Previous month"
				>
					<svg className="bp-calendar-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
						<path d="m15 18-6-6 6-6" />
					</svg>
				</button>
				<span className="bp-calendar-month">{ monthLabel }</span>
				<button
					type="button"
					className="bp-calendar-nav"
					onClick={ () => setView( new Date( view.getFullYear(), view.getMonth() + 1, 1 ) ) }
					aria-label="Next month"
				>
					<svg className="bp-calendar-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
						<path d="m9 18 6-6-6-6" />
					</svg>
				</button>
			</div>
			<div className="bp-calendar-grid" role="grid" aria-label={ monthLabel }>
				{ weekdayNames.map( ( weekday ) => (
					<span className="bp-calendar-weekday" key={ weekday }>{ weekday }</span>
				) ) }
				{ days.map( ( day ) => {
					const inMonth = day.getMonth() === view.getMonth();
					const isSelected = sameDay( day, selected );
					const isPast = day.getTime() < todayStart.getTime();
					return (
						<button
							type="button"
							key={ day.toISOString() }
							className="bp-calendar-day"
							data-current-month={ inMonth ? 'true' : 'false' }
							data-selected={ isSelected ? 'true' : 'false' }
							data-today={ sameDay( day, today ) ? 'true' : 'false' }
							onClick={ () => chooseDate( day ) }
							disabled={ isPast }
							aria-label={ day.toLocaleDateString( undefined, { dateStyle: 'full' } ) }
							aria-pressed={ isSelected }
						>
							{ day.getDate() }
						</button>
					);
				} ) }
			</div>
			<label className="bp-schedule-time">
				<span>Time</span>
				<input
					type="time"
					value={ `${ pad( selected.getHours() ) }:${ pad( selected.getMinutes() ) }` }
					min={ minimumTime }
					onChange={ chooseTime }
				/>
			</label>
		</div>
	);
}
