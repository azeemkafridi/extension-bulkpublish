/**
 * Media picker — the extension's replacement for the WP plugin's wp.media
 * field. Files upload to BulkPublish immediately on selection (simple POST for
 * ≤100 MB, multipart for larger), and a "Grab page images" panel pulls images
 * from the tab the user is on.
 */
import { useState, useRef } from 'react';
import { errorMessage } from '@/lib/api.js';
import { SIMPLE_UPLOAD_MAX_BYTES } from '@/lib/constants.js';
import { multipartUpload } from '@/lib/multipart.js';
import { collectPageImages, fetchPageImage, b64ToBlob } from '../page.js';
import { Notice, Spinner } from './ui.jsx';

const putPart = async ( url, body ) => {
	const res = await fetch( url, { method: 'PUT', body } );
	if ( ! res.ok ) {
		throw new Error( `Part upload failed (${ res.status })` );
	}
	// R2 returns the part's ETag as a quoted header.
	const etag = ( res.headers.get( 'ETag' ) || '' ).replace( /"/g, '' );
	if ( ! etag ) {
		throw new Error( 'Part upload returned no ETag' );
	}
	return { etag };
};

export function MediaField( { client, ids = [], items = {}, onChange } ) {
	const [ err, setErr ] = useState( '' );
	const [ uploading, setUploading ] = useState( false );
	const [ progress, setProgress ] = useState( '' );
	const [ pageImages, setPageImages ] = useState( null ); // null = closed
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
	};

	const uploadBlob = async ( blob, name ) => {
		if ( blob.size > SIMPLE_UPLOAD_MAX_BYTES ) {
			const res = await multipartUpload( {
				client,
				file: { name, type: blob.type, size: blob.size },
				getPart: async ( start, end ) => blob.slice( start, end ),
				putPart,
				onProgress: ( { partsDone, partsTotal } ) =>
					setProgress( `Uploading ${ name }… part ${ partsDone }/${ partsTotal }` ),
			} );
			return res.file;
		}
		setProgress( `Uploading ${ name }…` );
		const res = await client.uploadMedia( blob, name );
		return res.file;
	};

	const onFiles = async ( fileList ) => {
		const files = Array.from( fileList || [] );
		if ( ! files.length ) {
			return;
		}
		setErr( '' );
		setUploading( true );
		try {
			for ( const f of files ) {
				const file = await uploadBlob( f, f.name );
				add( file.id, {
					url: f.type.startsWith( 'image/' )
						? URL.createObjectURL( f )
						: null,
					type: f.type.startsWith( 'video/' ) ? 'video' : 'image',
					name: f.name,
				} );
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

	const openPageImages = async () => {
		setErr( '' );
		setPageImages( [] );
		const found = await collectPageImages();
		setPageImages( found );
	};

	const grabImage = async ( src ) => {
		setErr( '' );
		setGrabbing( src );
		try {
			const got = await fetchPageImage( src );
			if ( ! got ) {
				throw new Error(
					'Could not read that image from the page. Save it and upload as a file instead.'
				);
			}
			const blob = b64ToBlob( got.b64, got.type );
			const ext = ( got.type.split( '/' )[ 1 ] || 'jpg' ).split( '+' )[ 0 ];
			const file = await uploadBlob( blob, `page-image.${ ext }` );
			add( file.id, { url: src, type: 'image', name: file.fileName || 'page image' } );
		} catch ( e ) {
			setErr( errorMessage( e ) );
		} finally {
			setGrabbing( '' );
		}
	};

	return (
		<div>
			<div className="bp-media-grid">
				{ ids.map( ( id ) => {
					const item = items[ id ] || {};
					return (
						<div className="bp-media-item" key={ id }>
							{ item.type === 'video' ? (
								<div className="bp-media-video">▶</div>
							) : item.url ? (
								<img src={ item.url } alt="" />
							) : (
								<div className="bp-media-video">🖼</div>
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
			<button
				type="button"
				className="bp-linkbtn"
				disabled={ uploading }
				onClick={ openPageImages }
			>
				Grab images from this page
			</button>
			{ uploading && <Spinner label={ progress || 'Uploading…' } /> }
			{ err && <Notice type="error">{ err }</Notice> }
			{ pageImages !== null && (
				<div className="bp-page-images">
					{ pageImages.length === 0 ? (
						<span className="bp-muted">No usable images found on this page.</span>
					) : (
						<div className="bp-media-grid">
							{ pageImages.map( ( img ) => (
								<button
									type="button"
									key={ img.src }
									className="bp-media-item bp-media-pick"
									disabled={ !! grabbing }
									onClick={ () => grabImage( img.src ) }
									title={ `${ img.width }×${ img.height }` }
								>
									<img src={ img.src } alt="" />
									{ grabbing === img.src && <span className="bp-spinner" /> }
								</button>
							) ) }
						</div>
					) }
					<button
						type="button"
						className="bp-linkbtn"
						onClick={ () => setPageImages( null ) }
					>
						Close
					</button>
				</div>
			) }
		</div>
	);
}
