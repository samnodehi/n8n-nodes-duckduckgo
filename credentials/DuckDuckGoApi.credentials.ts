import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DuckDuckGoApi implements ICredentialType {
	name = 'duckDuckGoApi';
	displayName = 'DuckDuckGo API';
	documentationUrl = 'https://duckduckgo.com/api';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description: 'The API key for DuckDuckGo API access',
		},
	];
}