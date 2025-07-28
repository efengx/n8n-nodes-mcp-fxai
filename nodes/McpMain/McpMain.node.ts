import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';
import { MainV1 } from './MainV1';


export class McpMain extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			/**
			 * 组件的基本信息
			 */
			displayName: 'MCP Main',
			name: 'mcpMain',
			icon: 'fa:robot',
			iconColor: 'black',
			group: ['transform'],
			description: 'Interact with MCP Main API',
			defaultVersion: 1,
			codex: {
				alias: ['MCP', 'Main'],
				categories: ['MCP'],
				subcategories: {
					AI: ['Agents', 'Root Nodes'],
				},
				resources: {
					primaryDocumentation: [
						{
							url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/',
						},
					],
				},
			},
		};

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			1: new MainV1(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
