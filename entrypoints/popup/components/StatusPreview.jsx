import { useState } from 'react';
import { Notice } from './ui.jsx';
import { StatusList } from './StatusList.jsx';

const platform = ( id, name, status, errorMessage = '' ) => ( {
	id,
	platform: name,
	status,
	...( errorMessage ? { errorMessage } : {} ),
} );

const SCENARIOS = [
	{
		id: 'submitting',
		label: 'Starting publication',
		notice: { type: 'info', text: 'Publishing to 3 channels…' },
	},
	{
		id: 'publishing',
		label: 'Publishing in progress',
		post: {
			id: 'preview-publishing',
			status: 'publishing',
			approvalStatus: 'none',
			postPlatforms: [
				platform( 'preview-x', 'x', 'published' ),
				platform( 'preview-linkedin', 'linkedin', 'publishing' ),
				platform( 'preview-facebook', 'facebook', 'pending' ),
			],
		},
	},
	{
		id: 'published',
		label: 'Published successfully',
		post: {
			id: 'preview-published',
			status: 'published',
			approvalStatus: 'none',
			postPlatforms: [
				platform( 'preview-x', 'x', 'published' ),
				platform( 'preview-linkedin', 'linkedin', 'published' ),
				platform( 'preview-facebook', 'facebook', 'published' ),
			],
		},
	},
	{
		id: 'partial',
		label: 'Partially published',
		post: {
			id: 'preview-partial',
			status: 'partial',
			approvalStatus: 'none',
			postPlatforms: [
				platform( 'preview-x', 'x', 'published' ),
				platform( 'preview-linkedin', 'linkedin', 'published' ),
				platform(
					'preview-facebook',
					'facebook',
					'failed',
					'Facebook rejected the post. Reconnect the channel and retry.'
				),
			],
		},
	},
	{
		id: 'failed',
		label: 'Publishing failed',
		post: {
			id: 'preview-failed',
			status: 'failed',
			approvalStatus: 'none',
			postPlatforms: [
				platform( 'preview-x', 'x', 'failed', 'The channel connection has expired.' ),
				platform(
					'preview-linkedin',
					'linkedin',
					'failed',
					'LinkedIn could not publish this media format.'
				),
			],
		},
	},
	{
		id: 'scheduled',
		label: 'Scheduled',
		post: {
			id: 'preview-scheduled',
			status: 'scheduled',
			approvalStatus: 'none',
			postPlatforms: [
				platform( 'preview-x', 'x', 'scheduled' ),
				platform( 'preview-linkedin', 'linkedin', 'scheduled' ),
			],
		},
	},
	{
		id: 'approval',
		label: 'Awaiting approval',
		post: {
			id: 'preview-approval',
			status: 'scheduled',
			approvalStatus: 'pending',
			postPlatforms: [
				platform( 'preview-x', 'x', 'scheduled' ),
				platform( 'preview-linkedin', 'linkedin', 'scheduled' ),
			],
		},
	},
	{
		id: 'rejected',
		label: 'Approval rejected',
		post: {
			id: 'preview-rejected',
			status: 'draft',
			approvalStatus: 'rejected',
			rejectionReason: 'Please update the campaign link before publishing.',
			postPlatforms: [
				platform( 'preview-x', 'x', 'pending' ),
				platform( 'preview-linkedin', 'linkedin', 'pending' ),
			],
		},
	},
	{
		id: 'request-error',
		label: 'Request error',
		notice: {
			type: 'error',
			text: 'The post could not be created. Check your connection and try again.',
		},
	},
];

export function StatusPreview() {
	const [ selectedId, setSelectedId ] = useState( SCENARIOS[ 0 ].id );
	const scenario = SCENARIOS.find( ( item ) => item.id === selectedId ) || SCENARIOS[ 0 ];

	return (
		<div className="bp-status-preview bp-stack">
			<Notice type="warning">
				Preview only — this screen uses local sample data and never contacts BulkPublish.
			</Notice>
			<div className="bp-field">
				<div className="bp-label">Preview a response</div>
				<div className="bp-override-select-wrap">
					<select
						className="bp-override-select"
						value={ selectedId }
						onChange={ ( event ) => setSelectedId( event.target.value ) }
					>
						{ SCENARIOS.map( ( item ) => (
							<option key={ item.id } value={ item.id }>
								{ item.label }
							</option>
						) ) }
					</select>
					<svg className="bp-override-chevron" viewBox="0 0 24 24" aria-hidden="true">
						<path d="m6 9 6 6 6-6" />
					</svg>
				</div>
			</div>
			<div className="bp-publish-status" aria-live="polite">
				{ scenario.notice && (
					<Notice type={ scenario.notice.type }>{ scenario.notice.text }</Notice>
				) }
				{ scenario.post && (
					<StatusList previewPost={ scenario.post } poll={ false } />
				) }
			</div>
		</div>
	);
}
