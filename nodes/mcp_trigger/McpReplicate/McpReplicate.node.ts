import {
	IWebhookFunctions,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionType, Node } from 'n8n-workflow';
import { getConnectedTools } from '../../../utils/helpers';
import type { CompressionResponse } from './FlushingSSEServerTransport';
import { McpServerSingleton } from './McpServer';
import type { McpServer } from './McpServer';

const MCP_SSE_SETUP_PATH = 'sse';
const MCP_SSE_MESSAGES_PATH = 'messages';

export class McpReplicate extends Node {
	description: INodeTypeDescription = {
		displayName: 'MCP Replicate Trigger',
		name: 'mcpReplicate',
		icon: 'fa:image',
		group: ['trigger'],
		version: 1,
		description: 'Expose replicate tools as an MCP Server endpoint',
		activationMessage: 'You can now connect your MCP Clients to the SSE URL.',
		defaults: {
			name: 'MCP Replicate Trigger',
		},
		codex: {
			categories: ['AI', 'Core Nodes'],
			subcategories: {
				AI: ['Root Nodes', 'Model Context Protocol'],
				'Core Nodes': ['Other Trigger Nodes'],
			},
			alias: ['Model Context Protocol', 'MCP Replicate Server'],
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger/',
					},
				],
			},
		},
		triggerPanel: {
			header: 'Listen for MCP events',
			executionsHelp: {
				inactive:
					"This trigger has two modes: test and production.<br /><br /><b>Use test mode while you build your workflow</b>. Click the 'execute step' button, then make an MCP request to the test URL. The executions will show up in the editor.<br /><br /><b>Use production mode to run your workflow automatically</b>. <a data-key='activate'>Activate</a> the workflow, then make requests to the production URL. These executions will show up in the <a data-key='executions'>executions list</a>, but not the editor.",
				active:
					"This trigger has two modes: test and production.<br /><br /><b>Use test mode while you build your workflow</b>. Click the 'execute step' button, then make an MCP request to the test URL. The executions will show up in the editor.<br /><br /><b>Use production mode to run your workflow automatically</b>. Since your workflow is activated, you can make requests to the production URL. These executions will show up in the <a data-key='executions'>executions list</a>, but not the editor.",
			},
			activationHint:
				'Once you’ve finished building your workflow, run it without having to click this button by using the production URL.',
		},

		/**
		 * 确定组件的UI样式
		 */
		inputs: [
			{
				type: NodeConnectionType.AiTool,
				displayName: 'Tools',
			},
		],
		outputs: [],
		outputNames: ['Tool'],

		/**
		 * 组件参数
		 */
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Bearer Auth', value: 'bearerAuth' },
					{ name: 'Header Auth', value: 'headerAuth' },
				],
				default: 'none',
				description: 'The way to authenticate',
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: 'webhook',
				required: true,
				description: 'The base path for this MCP server',
			},
		],
		webhooks: [
			{
				name: 'setup',
				httpMethod: 'GET',
				responseMode: 'onReceived',
				isFullPath: true,
				path: `={{$parameter["path"]}}/${MCP_SSE_SETUP_PATH}`,
				nodeType: 'mcp',
				ndvHideMethod: true,
				ndvHideUrl: false,
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				isFullPath: true,
				path: `={{$parameter["path"]}}/${MCP_SSE_MESSAGES_PATH}`,
				nodeType: 'mcp',
				ndvHideMethod: true,
				ndvHideUrl: true,
			},
		],
	};

	async webhook(context: IWebhookFunctions): Promise<IWebhookResponseData> {
		const webhookName = context.getWebhookName();
		const req = context.getRequestObject();
		const resp = context.getResponseObject() as unknown as CompressionResponse;

		// 验证Webhook Authentication
		// try {
		// 	await validateWebhookAuthentication(context, 'authentication');
		// } catch (error) {
		// 	if (error instanceof WebhookAuthorizationError) {
		// 		resp.writeHead(error.responseCode);
		// 		resp.end(error.message);
		// 		return { noWebhookResponse: true };
		// 	}
		// 	throw error;
		// }

		const mcpServer: McpServer = McpServerSingleton.instance(context.logger);

		if (webhookName === 'setup') {
			// Sets up the transport and opens the long-lived connection. This resp
			// will stay streaming, and is the channel that sends the events
			const postUrl = req.path.replace(
				new RegExp(`/${MCP_SSE_SETUP_PATH}$`),
				`/${MCP_SSE_MESSAGES_PATH}`,
			);
			await mcpServer.connectTransport(postUrl, resp);

			return { noWebhookResponse: true };
		} else if (webhookName === 'default') {
			// This is the command-channel, and is actually executing the tools. This
			// sends the response back through the long-lived connection setup in the
			// 'setup' call
			const connectedTools = await getConnectedTools(context, true);

			const wasToolCall = await mcpServer.handlePostMessage(req, resp, connectedTools);

			if (wasToolCall) return { noWebhookResponse: true, workflowData: [[{ json: {} }]] };
			return { noWebhookResponse: true };
		}

		return { workflowData: [[{ json: {} }]] };
	}
}
