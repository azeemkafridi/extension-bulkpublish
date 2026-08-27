/**
 * Settings tab — API key (masked once saved, like the WP plugin's settings
 * screen) and the account-level defaults the extension controls.
 *
 * Link tracking is deliberately a THREE-option control: leaving it on
 * "Account default" omits linkTrackingOverride from post bodies entirely,
 * which is not the same as forcing it off.
 */
import { useState } from 'react';
import { errorMessage } from '@/lib/api.js';
import { Button, TextInput, Notice, Segmented } from './ui.jsx';

const IconPencil = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
);

export function Settings( {
	hasKey,
	onSaveKey,
	onDisconnect,
	settings,
	onSettingsChange,
	testKey,
} ) {
	const [ keyInput, setKeyInput ] = useState( '' );
	const [ editing, setEditing ] = useState( ! hasKey );
	const [ saving, setSaving ] = useState( false );
	const [ msg, setMsg ] = useState( null ); // { type, text }

	const save = async () => {
		const key = keyInput.trim();
		if ( ! key ) {
			return;
		}
		if ( ! key.startsWith( 'bp_' ) ) {
			setMsg( { type: 'error', text: 'API keys start with bp_ — copy the full key.' } );
			return;
		}
		setSaving( true );
		setMsg( null );
		try {
			const res = await testKey( key );
			await onSaveKey( key );
			setKeyInput( '' );
			setEditing( false );
			setMsg( {
				type: 'success',
				text: `Connected — ${ ( res.channels || [] ).length } channels available.`,
			} );
		} catch ( e ) {
			setMsg( { type: 'error', text: errorMessage( e ) } );
		} finally {
			setSaving( false );
		}
	};

	return (
		<div className="bp-settings">
			<section className="bp-setting">
				<h2 className="bp-setting-label">API key</h2>

				{ hasKey && ! editing ? (
					<>
						<div className="bp-keyrow">
							<code className="bp-key-mask">bp_••••••••••••</code>
							<button
								type="button"
								className="bp-iconbtn"
								onClick={ () => setEditing( true ) }
								title="Replace API key"
								aria-label="Replace API key"
							>
								<IconPencil />
							</button>
						</div>
						<p className="bp-setting-hint">
							Stored only in this browser's extension storage — never
							synced to your other devices.
						</p>
						{ /* Disconnect keeps its words: an icon-only control for a
						     destructive action is too easy to hit by accident. It sits
						     on its own line so it is never mistaken for part of the
						     key row. */ }
						<div className="bp-setting-actions">
							<Button variant="ghost" size="sm" onClick={ onDisconnect }>
								Disconnect
							</Button>
						</div>
					</>
				) : (
					<>
						<TextInput
							type="password"
							value={ keyInput }
							onChange={ ( e ) => setKeyInput( e.target.value ) }
							placeholder="bp_…"
							autoComplete="off"
						/>
						<p className="bp-setting-hint">
							Create one at{ ' ' }
							<a
								href="https://app.bulkpublish.com/developer"
								target="_blank"
								rel="noopener noreferrer"
								className="bp-link"
							>
								app.bulkpublish.com/developer
							</a>
							. Stored only in this browser's extension storage — never synced.
						</p>
						<div className="bp-setting-actions">
							<Button onClick={ save } loading={ saving } disabled={ ! keyInput.trim() }>
								Save &amp; verify
							</Button>
							{ hasKey && (
								<Button variant="ghost" onClick={ () => setEditing( false ) }>
									Cancel
								</Button>
							) }
						</div>
					</>
				) }
			</section>

			<section className="bp-setting">
				<h2 className="bp-setting-label">Link tracking</h2>
				<Segmented
					ariaLabel="Link tracking"
					value={ settings.linkTrackingDefault || 'default' }
					options={ [
						{ value: 'default', label: 'Account default' },
						{ value: 'on', label: 'On' },
						{ value: 'off', label: 'Off' },
					] }
					onChange={ ( v ) =>
						onSettingsChange( { ...settings, linkTrackingDefault: v } )
					}
				/>
				<p className="bp-setting-hint">
					“Account default” inherits your BulkPublish workspace setting;
					“Off” forces plain links for posts sent from this extension.
				</p>
			</section>

			{ msg && <Notice type={ msg.type }>{ msg.text }</Notice> }
		</div>
	);
}
