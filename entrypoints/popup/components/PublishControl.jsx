import { useState, useEffect, useRef } from 'react';
import { publishingItem } from '@/lib/storage.js';
import { Button, Notice } from './ui.jsx';
import { StatusList } from './StatusList.jsx';

export function usePublishingRun( client ) {
	const [ run, setRun ] = useState( null );
	useEffect( () => {
		let alive = true;
		const unwatch = publishingItem.watch( value => { if ( alive ) setRun( value ); } );
		publishingItem.getValue().then( value => { if ( alive ) setRun( value ); } );
		return () => { alive = false; unwatch(); };
	}, [] );
	const postId = run?.postId;
	useEffect( () => {
		if ( ! postId ) return;
		let alive = true;
		let timer;
		const check = async () => {
			try {
				const post = await client.getPost( postId );
				const current = await publishingItem.getValue();
				if ( alive && current?.postId === postId && current.phase !== 'submitting' ) {
					await publishingItem.setValue( { ...current, post, error: null } );
				}
			} catch { /* Keep the last known result when offline. */ }
			if ( alive ) timer = setTimeout( check, 4000 );
		};
		check();
		return () => { alive = false; clearTimeout( timer ); };
	}, [ client, postId ] );
	return run;
}

export function PublishControl( { run, client, onDone } ) {
	const [ open, setOpen ] = useState( false );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );
	const root = useRef( null );
	const [ now, setNow ] = useState( Date.now() );
	useEffect( () => { const timer = setInterval( () => setNow( Date.now() ), 5000 ); return () => clearInterval( timer ); }, [] );
	useEffect( () => {
		const outside = event => { if ( ! root.current?.contains( event.target ) ) setOpen( false ); };
		document.addEventListener( 'pointerdown', outside );
		return () => document.removeEventListener( 'pointerdown', outside );
	}, [] );
	const post = run.post;
	const interrupted = run.phase === 'submitting' && now - run.startedAt > 45000;
	const running = ! interrupted && ( run.phase === 'submitting' || [ 'publishing', 'processing' ].includes( post?.status ) || post?.postPlatforms?.some( p => [ 'publishing', 'processing' ].includes( p.status ) ) );
	const uncertain = interrupted || ! post || post.status === 'unconfirmed';
	const failed = post?.postPlatforms?.some( p => [ 'failed', 'partial', 'unconfirmed' ].includes( p.status ) );
	const label = running ? 'Publishing…' : uncertain ? 'Check status' : post.approvalStatus === 'pending' ? 'Awaiting approval' : ({published:'Published',partial:'Partially published',failed:'Publishing failed',scheduled:'Scheduled',draft:'Saved draft'})[post.status] || 'Check status';
	const retry = async () => {
		if ( busy ) return;
		setBusy( true ); setError( '' );
		try {
			// One unscoped retry: the server retries every FAILED destination in
			// a single claim and leaves unconfirmed ones alone (no `republish`).
			// A scoped retry per destination did not work: the first flips the
			// post to publishing and every later one gets 409 ALREADY_PUBLISHING,
			// so only the first failed channel was ever retried.
			await client.retryPost( run.postId );
			const updated = await client.getPost( run.postId );
			await publishingItem.setValue( { ...run, phase: 'submitted', post: updated } );
		} catch ( e ) { setError( e.message ); } finally { setBusy( false ); }
	};
	return <div className="bp-publish-control" ref={root} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}}>
		<Button className={`bp-publish-state${running || post?.status==='published' ? ' bp-publish-state-icon' : ''}`} aria-expanded={open} aria-controls="bp-publish-results" onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)}>
			{running ? <span className="bp-spinner"/> : post?.status==='published' ? <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5"/><path d="m4.75 8 2.1 2.1 4.4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
			{label}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
		</Button>
		{open && <div className="bp-publish-results-anchor"><section className="bp-publish-results" id="bp-publish-results" aria-label="Publishing results">
			{post && <StatusList previewPost={post} poll={false} showPostActions={false} hideSummary/>}
			{(uncertain || run.error) && <Notice type="warning">{run.error || 'The submission outcome is not confirmed. Check Recent in BulkPublish before starting another post.'}</Notice>}
			{error && <Notice type="error">{error}</Notice>}
			{!running && run.postId && <Button variant="ghost" disabled={busy} onClick={async()=>{try{const post=await client.getPost(run.postId);await publishingItem.setValue({...run,phase:'submitted',post,error:null});}catch(e){setError(e.message);}}}>Refresh status</Button>}
			{!running && failed && <Button disabled={busy} onClick={retry}>Retry failed channels</Button>}
			{!running && <Button className="bp-publish-done" disabled={busy} onClick={()=>{if(uncertain && !window.confirm('Check Recent in BulkPublish first. The previous request may have created a post. Clear this result and start fresh?'))return;onDone();}}>Done</Button>}
		</section></div>}
	</div>;
}
