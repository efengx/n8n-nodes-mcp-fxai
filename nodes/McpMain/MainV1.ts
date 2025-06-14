import type {
	INodeType,
	INodeTypeDescription,
	INodeTypeBaseDescription,
	INodeInputFilter,
	IExecuteFunctions,
	INodeExecutionData,
	INodeInputConfiguration,
} from 'n8n-workflow';
import {NodeConnectionType} from 'n8n-workflow';

import { toolsAgentExecute } from './execute';


// Function used in the inputs expression to figure out which inputs to
// display based on the agent type
function getInputs(hasOutputParser?: boolean): Array<NodeConnectionType | INodeInputConfiguration> {
	interface SpecialInput {
		type: NodeConnectionType;
		filter?: INodeInputFilter;
		required?: boolean;
	}

	const getInputData = (
		inputs: SpecialInput[],
	): Array<NodeConnectionType | INodeInputConfiguration> => {
		const displayNames: { [key: string]: string } = {
			ai_languageModel: 'Model',
			ai_memory: 'Memory',
			ai_tool: 'Tool',
			ai_outputParser: 'Output Parser',
		};

		return inputs.map(({ type, filter }) => {
			const isModelType = type === 'ai_languageModel';
			let displayName = type in displayNames ? displayNames[type] : undefined;
			if (isModelType) {
				displayName = 'Chat Model';
			}
			const input: INodeInputConfiguration = {
				type,
				displayName,
				required: isModelType,
				maxConnections: ['ai_languageModel', 'ai_memory', 'ai_outputParser'].includes(
					type as NodeConnectionType,
				)
					? 1
					: undefined,
			};

			if (filter) {
				input.filter = filter;
			}

			return input;
		});
	};

	let specialInputs: SpecialInput[] = [
		{
			type: NodeConnectionType.AiLanguageModel,
			filter: {
				nodes: [
					'@n8n/n8n-nodes-langchain.lmChatAnthropic',
					'@n8n/n8n-nodes-langchain.lmChatAzureOpenAi',
					'@n8n/n8n-nodes-langchain.lmChatAwsBedrock',
					'@n8n/n8n-nodes-langchain.lmChatMistralCloud',
					'@n8n/n8n-nodes-langchain.lmChatOllama',
					'@n8n/n8n-nodes-langchain.lmChatOpenAi',
					'@n8n/n8n-nodes-langchain.lmChatGroq',
					'@n8n/n8n-nodes-langchain.lmChatGoogleVertex',
					'@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
					'@n8n/n8n-nodes-langchain.lmChatDeepSeek',
					'@n8n/n8n-nodes-langchain.lmChatOpenRouter',
					'@n8n/n8n-nodes-langchain.lmChatXAiGrok',
				],
			},
		},
		{
			type: NodeConnectionType.AiMemory,
		},
		{
			type: NodeConnectionType.AiTool,
			required: true,
		},
		{
			type: NodeConnectionType.AiOutputParser,
		},
	];

	if (hasOutputParser === false) {
		specialInputs = specialInputs.filter((input) => input.type !== 'ai_outputParser');
	}
	return [NodeConnectionType.Main, ...getInputData(specialInputs)];
}

export class MainV1 implements INodeType {
	description: INodeTypeDescription;

	constructor(baseDescription: INodeTypeBaseDescription) {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: 'MCP Main',
				color: '#404040',
			},
			inputs: `={{
				((hasOutputParser) => {
					${getInputs.toString()};
					return getInputs(hasOutputParser)
				})($parameter.hasOutputParser === undefined || $parameter.hasOutputParser === true)
			}}`,
			outputs: [NodeConnectionType.Main],
			properties: [
				{
					displayName: 'Source for Prompt (User Message)',
					name: 'promptType',
					type: 'options',
					options: [
						{
							name: 'Connected Chat Trigger Node',
							value: 'auto',
							description:
								"Looks for an input field called 'chatInput' that is coming from a directly connected Chat Trigger",
						},
						{
							name: 'Define Below',
							value: 'define',
							description: 'Use an expression to reference data in previous nodes or enter static text',
						},
					],
					default: 'auto',
				},
				{
					displayName: 'Prompt (User Message)',
					name: 'text',
					type: 'string',
					required: true,
					default: '',
					placeholder: 'e.g. Hello, how can you help me?',
					typeOptions: {
						rows: 2,
					},
					displayOptions: {
						show: {
							promptType: ['define'],
						},
					},
				},
				{
					displayName: 'Prompt (User Message)',
					name: 'text',
					type: 'string',
					required: true,
					default: '={{ $json.chatInput }}',
					typeOptions: {
						rows: 2,
					},
					disabledOptions: { show: { promptType: ['auto'] } },
					displayOptions: {
						show: {
							promptType: ['auto'],
						},
					},
				},
				{
					displayName: 'Require Specific Output Format',
					name: 'hasOutputParser',
					type: 'boolean',
					default: false,
					noDataExpression: true,
				},
				{
					displayName: `Connect an <a data-action='openSelectiveNodeCreator' data-action-parameter-connectiontype='${NodeConnectionType.AiOutputParser}'>output parser</a> on the canvas to specify the output format you require`,
					name: 'notice',
					type: 'notice',
					default: '',
					displayOptions: {
						show: {
							hasOutputParser: [true],
						},
					},
				},
				{
					displayName: 'Options',
					name: 'options',
					type: 'collection',
					default: {},
					placeholder: 'Add Option',
					options: [
						{
							displayName: 'Automatically Passthrough Binary Images',
							name: 'passthroughBinaryImages',
							type: 'boolean',
							default: true,
							description:
								'Whether or not binary images should be automatically passed through to the agent as image type messages',
						},
						{
							displayName: 'Batch Processing',
							name: 'batching',
							type: 'collection',
							placeholder: 'Add Batch Processing Option',
							description: 'Batch processing options for rate limiting',
							default: {},
							options: [
								{
									displayName: 'Batch Size',
									name: 'batchSize',
									default: 1,
									type: 'number',
									description:
										'How many items to process in parallel. This is useful for rate limiting, but might impact the log output ordering.',
								},
								{
									displayName: 'Delay Between Batches',
									name: 'delayBetweenBatches',
									default: 0,
									type: 'number',
									description: 'Delay in milliseconds between batches. This is useful for rate limiting.',
								},
							]
						},
						{
							displayName: 'Max Iterations',
							name: 'maxIterations',
							type: 'number',
							default: 10,
							description: 'The maximum number of iterations the agent will run before stopping',
						},
						{
							displayName: 'Return Intermediate Steps',
							name: 'returnIntermediateSteps',
							type: 'boolean',
							default: false,
							description: 'Whether or not the output should include intermediate steps the agent took',
						},
						{
							displayName: 'System Message',
							name: 'systemMessage',
							type: 'string',
							default: 'You are a helpful assistant',
							description: 'The message that will be sent to the agent before the conversation starts',
							typeOptions: {
								rows: 6,
							},
						},
					],
				},
			],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await toolsAgentExecute.call(this);
	}
}
