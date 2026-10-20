/**
 * Media picker — the extension's replacement for the WP plugin's wp.media
 * field. Files upload to BulkPublish immediately on selection (simple POST for
 * ≤100 MB, multipart for larger). “Add page image” immediately attaches the
 * page's social image (or its largest usable image) to this same picker.
 */
import { useState, useRef } from 'react';
import { errorMessage } from '@/lib/api.js';
import {
	canTryAnotherPageImage,
	pageImageCandidates,
	pageImageError,
} from '@/lib/page-media.js';
import { collectPageImages } from '../page.js';
import { uploadBlob } from '../upload.js';
import { Notice, Spinner } from './ui.jsx';

/**
 * Preview URL that survives the popup closing. `URL.createObjectURL` handles
 * die with the document, so a reopened draft would show broken thumbnails —
 * the URLs the upload response gives back are the durable ones.
 */
const previewUrl = ( file, fallback ) =>
	file.thumbnailUrl || file.previewUrl || file.originalUrl || fallback || null;

export function MediaField( {
	client,
	ids = [],
	items = {},
	pageImage,
	onChange,
	onRemove,
	compact = false,
} ) {
	const [ err, setErr ] = useState( '' );
	const [ uploading, setUploading ] = useState( false );
	const [ progress, setProgress ] = useState( '' );
	const [ grabbing, setGrabbing ] = useState( '' );
	const fileRef = useRef( null );

	const add = ( id, item ) => {
		if ( ids.includes( id ) ) {
			return;
		}
		onChange( [ ...ids, id ], { ...items, [ id ]: item } );
	};

	const remove = ( id ) => {
		const nextItems = { ...items };
		delete nextItems[ id ];
		onChange( ids.filter( ( x ) => x !== id ), nextItems );
		// Detaching is the user's decision to not use the file at all, so the
		// upload it created should not sit in their library eating storage
		// quota. Composer decides whether deleting is actually safe.
		if ( onRemove ) {
			onRemove( id );
		}
	};

	const send = ( blob, name ) => uploadBlob( client, blob, name, setProgress );

	const onFiles = async ( fileList ) => {
		const files = Array.from( fileList || [] );
		if ( ! files.length ) {
			return;
		}
		setErr( '' );
		setUploading( true );
		// Keep a local accumulator. React props do not update while this async
		// loop is running, so calling add() repeatedly would rebuild every result
		// from the same stale ids/items snapshot and retain only the final file.
		let nextIds = [ ...ids ];
		let nextItems = { ...items };
		try {
			for ( const f of files ) {
				const file = await send( f, f.name );
				if ( nextIds.includes( file.id ) ) {
					continue;
				}
				nextIds = [ ...nextIds, file.id ];
				nextItems = { ...nextItems, [ file.id ]: {
					url: previewUrl( file ),
					type: f.type.startsWith( 'video/' ) ? 'video' : 'image',
					mimeType: file.mimeType || f.type,
					width: file.width,
					height: file.height,
					duration: file.duration,
					name: f.name,
				} };
				// Commit each successful upload so a later failed file does not make
				// earlier successful uploads disappear from the draft.
				onChange( nextIds, nextItems );
			}
		} catch ( e ) {
			setErr( errorMessage( e ) );
		} finally {
			setUploading( false );
			setProgress( '' );
			if ( fileRef.current ) {
				fileRef.current.value = '';
			}
		}
	};

	const addPageImage = async () => {
		setErr( '' );
		const found = await collectPageImages();
		const candidates = pageImageCandidates( pageImage, found );
		if ( ! candidates.length ) {
			setErr( 'No usable image was found on this page.' );
			return;
		}

		let lastError = null;
		for ( const src of candidates ) {
			setGrabbing( src );
			try {
				const response = await client.importMediaUrl( src );
				const file = response.file || response;
				add( file.id, {
					url: previewUrl( file, src ),
					type: 'image',
					mimeType: file.mimeType || 'image/jpeg',
					width: file.width,
					height: file.height,
					name: file.fileName || 'page image',
				} );
				setGrabbing( '' );
				return;
			} catch ( e ) {
				lastError = e;
				if ( ! canTryAnotherPageImage( e ) ) {
					break;
				}
			}
		}
		setGrabbing( '' );
		setErr( pageImageError( lastError ) );
	};

	return (
		<div className="bp-media-field">
			<div className="bp-media-grid">
				{ ids.map( ( id ) => {
					const item = items[ id ] || {};
					return (
						<div className="bp-media-item" key={ id }>
							{ item.url ? (
								<>
									<img src={ item.url } alt="" />
									{ item.type === 'video' && <span className="bp-media-play">▶</span> }
								</>
							) : (
								<div className="bp-media-video">{ item.type === 'video' ? '▶' : '🖼' }</div>
							) }
							<button
								type="button"
								className="bp-media-remove"
								onClick={ () => remove( id ) }
								aria-label="Remove"
							>
								×
							</button>
						</div>
					);
				} ) }
				<button
					type="button"
					className="bp-media-add"
					disabled={ uploading }
					onClick={ () => fileRef.current && fileRef.current.click() }
				>
					+ Add media
				</button>
			</div>
			<input
				ref={ fileRef }
				type="file"
				accept="image/*,video/*"
				multiple
				style={ { display: 'none' } }
				onChange={ ( e ) => onFiles( e.target.files ) }
			/>
			{ ! compact && (
				<button
					type="button"
					className="bp-linkbtn bp-page-image-link"
					disabled={ uploading || !! grabbing }
					onClick={ addPageImage }
					title={ pageImage ? 'Add the page image shown above' : 'Add the largest image found on this page' }
				>
					{ grabbing ? 'Adding page image…' : 'Add page image' }
				</button>
			) }
			{ uploading && <Spinner label={ progress || 'Uploading…' } /> }
			{ grabbing && <Spinner label="Adding page image…" /> }
			{ err && <Notice type="error">{ err }</Notice> }
		</div>
	);
}
