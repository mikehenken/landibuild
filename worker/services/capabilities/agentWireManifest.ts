/**
 * Static manifest of agent tool profiles (editor vs internal orchestration).
 * Served at GET /api/capabilities/agent-wire for discoverability.
 */
export const AGENT_WIRE_MANIFEST = {
	version: '1.0.0',
	name: 'landibuild-agent-capabilities',
	description:
		'Tool profile groupings for Landi agents; names align with landing-editor LangChain tools where applicable.',
	profiles: {
		editor: {
			description:
				'Browser/editor-bound tools (DOM, inspector, vision) — require an active editor session.',
			tools: [
				'updateElementStyles',
				'updatePageStructure',
				'injectComponent',
				'updateTextContent',
				'updateImage',
				'undoLastAction',
				'getPageHTML',
				'listEditableSections',
				'enableInspectorMode',
				'locateElement',
				'findSelectorByText',
				'inspectDOM',
				'getComputedStyle',
				'takeScreenshot',
			],
		},
		internal: {
			description: 'Server-side data and platform tools — use scoped service auth.',
			tools: [
				'createCollection',
				'listCollections',
				'addCollectionItem',
				'queryCollection',
				'updateCollectionSchema',
				'updateCollectionItem',
				'deleteCollectionItem',
				'getCollectionSchema',
				'queryUsers',
				'getUserBillingStatus',
				'getAgencyStats',
				'sendBulkEmail',
				'createMicroApp',
				'editMicroAppFile',
				'getMicroAppCode',
				'deployMicroApp',
				'generateImage',
				'listSites',
				'createSite',
				'listPages',
				'getAccountDetails',
				'createForm',
				'updateForm',
				'deleteForm',
				'listForms',
				'addFormTrigger',
				'listAssets',
				'roastCompetitor',
			],
		},
	},
} as const;

export type AgentWireManifest = typeof AGENT_WIRE_MANIFEST;
