import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutPurchasePrompts, storeSafe, IS_SAFARI } from '../lib/store-copy.js';

test( 'drops the upgrade sentence, keeps what happened', () => {
	assert.equal(
		withoutPurchasePrompts( "You've reached the posts per day limit (3/3) on the Free plan. Upgrade to Pro for a higher limit." ),
		"You've reached the posts per day limit (3/3) on the Free plan."
	);
} );

test( 'drops prices and add-on offers', () => {
	assert.equal(
		withoutPurchasePrompts( 'Channel limit reached. Add an extra channel slot for $2.99/month, or upgrade for more channels.' ),
		'Channel limit reached.'
	);
} );

test( 'falls back when nothing is left', () => {
	assert.equal( withoutPurchasePrompts( 'Upgrade to Business to use it.' ), 'This is not available on your current plan.' );
} );

test( 'leaves ordinary errors alone', () => {
	const msg = 'Instagram needs at least one image or video.';
	assert.equal( withoutPurchasePrompts( msg ), msg );
	assert.equal( withoutPurchasePrompts( '' ), '' );
	assert.equal( withoutPurchasePrompts( undefined ), undefined );
} );

test( 'is a no-op outside the Safari build', () => {
	assert.equal( IS_SAFARI, false );
	assert.equal( storeSafe( 'Upgrade to Pro.' ), 'Upgrade to Pro.' );
} );
