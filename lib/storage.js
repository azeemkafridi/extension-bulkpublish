/**
 * Typed storage items (wxt/storage). The API key deliberately lives in
 * `local:` — storage.sync replicates to every signed-in browser and its
 * transport is outside our control, so the key never goes there.
 */
import { storage } from 'wxt/utils/storage';

export const apiKeyItem = storage.defineItem( 'local:apiKey', {
	fallback: '',
} );

export const settingsItem = storage.defineItem( 'local:settings', {
	fallback: {
		linkTrackingDefault: 'default', // 'default' | 'on' | 'off'
		lastChannelIds: [],
	},
} );

/** Autosaved composer draft so an accidental popup dismiss loses nothing. */
export const draftItem = storage.defineItem( 'local:draft', {
	fallback: null,
} );

/**
 * Context-menu → popup handoff. session: clears when the browser closes,
 * which is the right lifetime for "the thing you just right-clicked".
 */
export const pendingPrefillItem = storage.defineItem( 'session:pendingPrefill', {
	fallback: null,
} );
