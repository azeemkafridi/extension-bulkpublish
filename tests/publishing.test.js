import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { BulkPublishClient } from '../lib/api.js';

const source = ( await readFile( new URL('../entrypoints/background.js', import.meta.url), 'utf8' ) )
	.replace(/^import .*;$/gm, '').replace('export default defineBackground', 'defineBackground');
function worker( publish ) {
	let run = null, listener;
	const context = {
		defineBackground: fn => fn(),
		publishingItem: { getValue: async()=>run, setValue: async value=>{run=value;} },
		apiKeyItem: {getValue:async()=>'test'},
		pendingPrefillItem: {},
		BulkPublishClient: class {createAndMaybePublish(...args){return publish(...args);}},
		errorMessage: error=>error.message,
		browser: {runtime:{id:'self',onMessage:{addListener:fn=>{listener=fn;}},onInstalled:{addListener:()=>{}}},contextMenus:{onClicked:{addListener:()=>{}}}},
	};
	vm.runInNewContext(source,context);
	return {get run(){return run;},send:()=>new Promise(resolve=>listener({type:'bulkpublish-submit',body:{},options:{},draft:{caption:'saved'}},{id:'self'},resolve))};
}
test('submission journal survives completion and blocks another create',async()=>{
	let creates=0;
	const w=worker(async(_body,options)=>{creates++;assert.equal(w.run.phase,'submitting');await options.onCreated({id:'one',status:'draft'});assert.equal(w.run.postId,'one');return{id:'one',status:'publishing'};});
	await w.send();
	assert.equal(w.run.phase,'submitted');
	assert.equal(w.run.draft.caption,'saved');
	assert.match((await w.send()).error,/previous publication/);
	assert.equal(creates,1);
});
test('uncertain create retains a journal and prevents blind resubmission',async()=>{
	const w=worker(async()=>{throw new Error('connection lost');});
	await w.send();assert.equal(w.run.phase,'uncertain');assert.equal(w.run.postId,null);
	assert.match((await w.send()).error,/previous publication/);
});
test('concurrent submission is rejected while the first request runs',async()=>{
	let finish;
	const w=worker(()=>new Promise(resolve=>{finish=resolve;}));
	const first=w.send();
	assert.match((await w.send()).error,/already in progress/);
	while(!finish)await Promise.resolve();
	finish({id:'one'});await first;
});
test('post ID is durably recorded before publication is requested',async()=>{
	let recorded=false;
	const client=new BulkPublishClient({apiKey:'test',fetchImpl:async url=>{
		if(url.endsWith('/publish'))assert.equal(recorded,true);
		return {ok:true,json:async()=>({id:'one',status:'draft'})};
	}});
	await client.createAndMaybePublish({}, {publishNow:true,onCreated:async post=>{assert.equal(post.id,'one');recorded=true;}});
});
