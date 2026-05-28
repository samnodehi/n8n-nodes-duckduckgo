import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TavilyApi implements ICredentialType {
	name = 'tavilyApi';
	displayName = 'Tavily API';
	documentationUrl = 'https://docs.tavily.com';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Tavily API key from https://app.tavily.com',
		},
	];
}
