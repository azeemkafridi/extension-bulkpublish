/**
 * Media picker — the extension's replacement for the WP plugin's wp.media
 * field. Files upload to BulkPublish immediately on selection (simple POST for
 * ≤100 MB, multipart for larger), and a "Grab page images" panel pulls images
 * from the tab the user is on.
 */
import { useState, useRef } from 'react';
import { errorMessage } from '@/lib/api.js';
import { collectPageImages, fetchPageImage, b64ToBlob } from '../page.js';
import { uploadBlob, extForMime } from '../upload.js';
import { Notice, Spinner } from './ui.jsx';

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

	const send = ( blob, name ) => uploadBlob( client, blob, name, setProgress );

	const onFiles = async ( fileList ) => {
		const files = Array.from( fileList || [] );
		if ( ! files.length ) {
			return;
		}
		setErr( '' );
		setUploading( true );
		try {
			for ( const f of files ) {
				const file = await send( f, f.name );
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
			const file = await send( blob, `page-image.${ extForMime( got.type ) }` );
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
