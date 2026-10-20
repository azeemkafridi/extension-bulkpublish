import test from 'node:test';
import assert from 'node:assert/strict';
import {
	BulkPublishClient,
	BulkPublishError,
	isApprovalRequired,
	errorMessage,
} from '../lib/api.js';

const jsonResponse = ( body, status = 200 ) => ( {
	ok: status < 400,
	status,
	json: async () => body,
} );

const makeClient = ( responder ) => {
	const calls = [];
	const client = new BulkPublishClient( {
		apiKey: 'bp_test',
		fetchImpl: async ( url, init ) => {
			calls.push( { url, init } );
			return responder( url, init, calls.length );
		},
	} );
	return { client, calls };
};

test( 'sends bearer auth and JSON content type', async () => {
	const { client, calls } = makeClient( () => jsonResponse( { ok: 1 } ) );
	await client.createPost( { content: 'hi' } );
	const { url, init } = calls[ 0 ];
	assert.equal( url, 'https://app.bulkpublish.com/api/posts' );
	assert.equal( init.method, 'POST' );
	assert.equal( init.headers.Authorization, 'Bearer bp_test' );
	assert.equal( init.headers[ 'Content-Type' ], 'application/json' );
	assert.equal( init.body, JSON.stringify( { content: 'hi' } ) );
} );

test( 'requests identify the extension and have distinct correlation IDs', async () => {
	const {client,calls}=makeClient(()=>jsonResponse({}));
	await client.getChannels();await client.getChannels();
	assert.equal(calls[0].init.headers['X-BulkPublish-Client'],'extension');
	assert.ok(calls[0].init.headers['X-BulkPublish-Version']);
	assert.notEqual(calls[0].init.headers['X-Request-ID'],calls[1].init.headers['X-Request-ID']);
} );

test( 'API errors retain the server correlation ID for diagnosis', async () => {
	const {client}=makeClient(()=>({...jsonResponse({error:'Failed'},500),headers:{get:()=> 'server-request-123'}}));
	await assert.rejects(client.getChannels(),error=>error.requestId==='server-request-123');
} );

test( 'trailing slash on baseUrl is trimmed', async () => {
	const calls = [];
	const client = new BulkPublishClient( {
		apiKey: 'bp_test',
		baseUrl: 'https://example.com/',
		fetchImpl: async ( url ) => {
			calls.push( url );
			return jsonResponse( {} );
		},
	} );
	await client.getChannels();
	assert.equal( calls[ 0 ], 'https://example.com/api/channels' );
} );

test( 'object-shaped API errors carry message, code, status', async () => {
	const { client } = makeClient( () =>
		jsonResponse(
			{ error: { message: 'Needs approval', code: 'APPROVAL_REQUIRED' } },
			403
		)
	);
	await assert.rejects( client.retryPost( 1 ), ( e ) => {
		assert.ok( e instanceof BulkPublishError );
		assert.equal( e.message, 'Needs approval' );
		assert.equal( e.code, 'APPROVAL_REQUIRED' );
		assert.equal( e.status, 403 );
		assert.ok( isApprovalRequired( e ) );
		return true;
	} );
} );

test( 'string-shaped media errors become the message', async () => {
	const { client } = makeClient( () =>
		jsonResponse( { error: 'File too large (max 100MB)' }, 400 )
	);
	await assert.rejects( client.uploadMedia( new Blob( [ 'x' ] ), 'x.png' ), ( e ) => {
		assert.equal( e.message, 'File too large (max 100MB)' );
		assert.equal( e.code, undefined );
		return true;
	} );
} );

test( 'remote media import sends the public URL to the authenticated API', async () => {
	const { client, calls } = makeClient( () =>
		jsonResponse( { file: { id: 21, originalUrl: 'https://cdn.example/stored.jpg' } }, 201 )
	);
	const result = await client.importMediaUrl( 'https://images.example/page.jpg' );
	assert.equal( result.file.id, 21 );
	assert.equal( calls[ 0 ].url, 'https://app.bulkpublish.com/api/media/import' );
	assert.equal( calls[ 0 ].init.body, JSON.stringify( { url: 'https://images.example/page.jpg' } ) );
} );

test( 'channel options include lookup query parameters', async () => {
	const calls = [];
	const client = new BulkPublishClient( {
		apiKey: 'bp_test',
		fetchImpl: async ( url, init ) => {
			calls.push( { url, init } );
			return jsonResponse( { items: [] } );
		},
	} );
	await client.getChannelOptions( 42, { q: 'design' } );
	assert.equal( calls[ 0 ].url, 'https://app.bulkpublish.com/api/channels/42/options?q=design' );
} );

test( 'capabilities are read from the authenticated channels response', async () => {
	const expected = { canCreatePosts: true, canPublishPosts: false, canApprovePosts: false };
	const { client } = makeClient( () => jsonResponse( { channels: [], capabilities: expected } ) );
	assert.deepEqual( await client.getCapabilities(), expected );
} );

test( 'network failure surfaces as NETWORK code', async () => {
	const client = new BulkPublishClient( {
		apiKey: 'bp_test',
		fetchImpl: async () => {
			throw new TypeError( 'Failed to fetch' );
		},
	} );
	await assert.rejects( client.getChannels(), ( e ) => {
		assert.equal( e.code, 'NETWORK' );
		return true;
	} );
} );

test( 'createAndMaybePublish publishes after create', async () => {
	const { client, calls } = makeClient( ( url ) => {
		if ( url.endsWith( '/api/posts' ) ) {
			return jsonResponse( { id: 42, status: 'draft', approvalStatus: 'none' }, 201 );
		}
		return jsonResponse( { id: 42, status: 'published' } );
	} );
	const post = await client.createAndMaybePublish(
		{ content: 'x', channels: [] },
		{ publishNow: true }
	);
	assert.equal( post.status, 'published' );
	assert.equal( calls.length, 2 );
	assert.ok( calls[ 1 ].url.endsWith( '/api/posts/42/publish' ) );
} );

test( 'createAndMaybePublish skips publish when approval is pending', async () => {
	const { client, calls } = makeClient( () =>
		jsonResponse( { id: 7, status: 'draft', approvalStatus: 'pending' }, 201 )
	);
	const post = await client.createAndMaybePublish(
		{ content: 'x', channels: [] },
		{ publishNow: true }
	);
	assert.equal( post.approvalStatus, 'pending' );
	assert.equal( calls.length, 1 );
} );

test( 'approval-required publish converts its existing draft instead of duplicating it', async () => {
	const { client, calls } = makeClient( ( url, init ) => {
		if ( url.endsWith( '/api/posts' ) ) {
			return jsonResponse( { id: 17, status: 'draft', approvalStatus: 'none' }, 201 );
		}
		if ( url.endsWith( '/api/posts/17/publish' ) ) {
			return jsonResponse(
				{ error: { message: 'Needs approval', code: 'APPROVAL_REQUIRED' } },
				403
			);
		}
		assert.equal( init.method, 'PUT' );
		return jsonResponse( { id: 17, status: 'scheduled', approvalStatus: 'pending' } );
	} );
	const fallback = {
		content: 'x',
		status: 'scheduled',
		scheduledAt: '2026-09-01T05:02:00.000Z',
		requestApproval: true,
	};
	const post = await client.createAndMaybePublish(
		{ content: 'x', status: 'draft' },
		{ publishNow: true, approvalFallback: fallback }
	);
	assert.equal( post.approvalStatus, 'pending' );
	assert.equal( calls.length, 3 );
	assert.ok( calls[ 2 ].url.endsWith( '/api/posts/17' ) );
	assert.equal( calls[ 2 ].init.body, JSON.stringify( fallback ) );
} );

test( 'publish failure after create carries bpPostId for retry', async () => {
	const { client } = makeClient( ( url ) => {
		if ( url.endsWith( '/api/posts' ) ) {
			return jsonResponse( { id: 9, status: 'draft', approvalStatus: 'none' }, 201 );
		}
		return jsonResponse( { error: { message: 'boom', code: 'INTERNAL_ERROR' } }, 500 );
	} );
	await assert.rejects(
		client.createAndMaybePublish( { content: 'x' }, { publishNow: true } ),
		( e ) => {
			assert.equal( e.bpPostId, 9 );
			return true;
		}
	);
} );

test( 'reject sends reason only when present', async () => {
	const { client, calls } = makeClient( () => jsonResponse( {} ) );
	await client.rejectPost( 1, 'nope' );
	await client.rejectPost( 2 );
	assert.equal( calls[ 0 ].init.body, JSON.stringify( { reason: 'nope' } ) );
	assert.equal( calls[ 1 ].init.body, JSON.stringify( {} ) );
} );

test( 'retry can target one platform result and explicitly republish', async () => {
	const { client, calls } = makeClient( () => jsonResponse( {} ) );
	await client.retryPost( 5, { postPlatformId: 12, republish: true } );
	assert.equal( calls[ 0 ].url, 'https://app.bulkpublish.com/api/posts/5/platforms/12/retry' );
	assert.equal( calls[ 0 ].init.body, JSON.stringify( { republish: true } ) );
} );

test( 'updateAndMaybePublish edits the same post before publishing', async () => {
	const { client, calls } = makeClient( ( url ) =>
		url.endsWith( '/publish' )
			? jsonResponse( { id: 31, status: 'published' } )
			: jsonResponse( { id: 31, status: 'draft', approvalStatus: 'none' } )
	);
	const post = await client.updateAndMaybePublish( 31, { content: 'edited' }, { publishNow: true } );
	assert.equal( post.status, 'published' );
	assert.equal( calls.length, 2 );
	assert.equal( calls[ 0 ].init.method, 'PUT' );
	assert.ok( calls[ 0 ].url.endsWith( '/api/posts/31' ) );
} );

test( 'errorMessage handles strings, errors, and nothing', () => {
	assert.equal( errorMessage( 'plain' ), 'plain' );
	assert.equal( errorMessage( new Error( 'oops' ) ), 'oops' );
	assert.equal( errorMessage( null ), 'Something went wrong.' );
} );
