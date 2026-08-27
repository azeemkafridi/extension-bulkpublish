/**
 * Clickable caption tokens — the extension's trimmed-down take on the WP
 * plugin's CaptionTokens.js. WordPress resolved a rich token set server-side
 * against the post; here only the current page exists, so the set is %%title%%
 * and %%link%%, resolved client-side at submit time.
 *
 * Chips insert at the caret rather than appending, so a token can be dropped
 * mid-sentence. The insertion itself lives in lib/caret.js so it can be tested.
 */
import { TOKENS } from '@/lib/prefill.js';

const LABELS = {
	title: 'Page title',
	link: 'Page URL',
};

export { insertAtCaret, insertToken } from '@/lib/caret.js';

export function CaptionTokens( { onInsert, disabled } ) {
	return (
		<div className="bp-tokens">
			<span className="bp-tokens-label">Insert</span>
			{ TOKENS.map( ( t ) => (
				<button
					type="button"
					key={ t }
					className="bp-chip"
					disabled={ disabled }
					onClick={ () => onInsert( t ) }
					title={ `Inserts %%${ t }%% — replaced with this page's ${
						t === 'title' ? 'title' : 'URL'
					} when the post is sent` }
				>
					{ LABELS[ t ] || t }
				</button>
			) ) }
		</div>
	);
}
