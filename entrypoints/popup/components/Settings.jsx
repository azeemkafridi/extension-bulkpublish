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
		<div className="bp-stack" style={ { gap: 16 } }>
			<div className="bp-field">
				<div className="bp-label">API key</div>
				{ hasKey && ! editing ? (
					<div className="bp-row" style={ { gap: 8 } }>
						<code className="bp-key-mask">bp_••••••••••••</code>
						<Button variant="secondary" size="sm" onClick={ () => setEditing( true ) }>
							Replace API key
						</Button>
						<Button variant="ghost" size="sm" onClick={ onDisconnect }>
							Disconnect
						</Button>
					</div>
				) : (
					<>
						<TextInput
							type="password"
							value={ keyInput }
							onChange={ ( e ) => setKeyInput( e.target.value ) }
							placeholder="bp_…"
							autoComplete="off"
						/>
						<span className="bp-hint">
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
						</span>
						<div className="bp-row" style={ { gap: 8, marginTop: 8 } }>
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
			</div>

			<div className="bp-field">
				<div className="bp-label">Link tracking</div>
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
				<span className="bp-hint">
					“Account default” inherits your BulkPublish workspace setting;
					“Off” forces plain links for posts sent from this extension.
				</span>
			</div>

			{ msg && <Notice type={ msg.type }>{ msg.text }</Notice> }
		</div>
	);
}
