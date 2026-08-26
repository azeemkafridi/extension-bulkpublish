import test from 'node:test';
import assert from 'node:assert/strict';
import { xPostCost, dollars, includesX, fmtLimit } from '../lib/cost.js';

test( 'no X selected costs nothing', () => {
	assert.equal( xPostCost( { platforms: [ 'linkedin' ], hasLink: true } ), 0 );
} );

test( 'plain tweet uses tweet_create', () => {
	assert.equal( xPostCost( { platforms: [ 'x' ], hasLink: false } ), 15 );
} );

test( 'link pricing plus media', () => {
	assert.equal(
		xPostCost( { platforms: [ 'x' ], hasLink: true, mediaCount: 2 } ),
		200 + 10
	);
} );

test( 'server price sheet wins over defaults', () => {
	assert.equal(
		xPostCost( {
			platforms: [ 'twitter' ],
			hasLink: false,
			costs: { tweet_create: 20 },
		} ),
		20
	);
} );

test( 'dollars formats dcents', () => {
	assert.equal( dollars( 200 ), '$0.20' );
	assert.equal( dollars( 15 ), '$0.015' );
} );

test( 'includesX accepts both keys', () => {
	assert.ok( includesX( [ 'twitter' ] ) );
	assert.ok( includesX( [ 'x' ] ) );
	assert.ok( ! includesX( [ 'facebook' ] ) );
} );

test( 'fmtLimit shows infinity for -1/null', () => {
	assert.equal( fmtLimit( 3, -1 ), '3 / ∞' );
	assert.equal( fmtLimit( 3, null ), '3 / ∞' );
	assert.equal( fmtLimit( 3, 10 ), '3 / 10' );
	assert.equal( fmtLimit( undefined, 10 ), '… / 10' );
} );
