/**
 * Proxy configuration and management for DuckDuckGo node
 *
 * This module provides proxy support for all HTTP requests
 * to bypass restrictions and improve privacy.
 */

import { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { URL } from 'url';

/**
 * Proxy configuration interface
 */
export interface IProxyConfig {
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

/**
 * Parse proxy URL into configuration object
 */
export function parseProxyUrl(proxyUrl: string): IProxyConfig {
  let url: URL;
  try {
    url = new URL(proxyUrl);
  } catch (error) {
    throw new Error(`Invalid proxy URL: ${proxyUrl}. Expected format: protocol://[user:pass@]host:port`);
  }

  const protocol = url.protocol.replace(':', '') as string;
  if (!['http', 'https', 'socks4', 'socks5'].includes(protocol)) {
    throw new Error(`Unsupported proxy protocol: ${protocol}`);
  }

  const config: IProxyConfig = {
    protocol: protocol as IProxyConfig['protocol'],
    host: url.hostname,
    port: url.port ? parseInt(url.port) : getDefaultPort(protocol),
  };

  if (url.username && url.password) {
    config.auth = {
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  }

  return config;
}

/**
 * Get default port for proxy protocol
 */
function getDefaultPort(protocol: string): number {
  switch (protocol) {
    case 'http':
      return 8080;
    case 'https':
      return 443;
    case 'socks4':
    case 'socks5':
      return 1080;
    default:
      return 8080;
  }
}

/**
 * Create proxy agent based on configuration
 */
export function createProxyAgent(config: IProxyConfig): any {
  const authString = config.auth
    ? `${config.auth.username}:${config.auth.password}@`
    : '';

  const proxyUrl = `${config.protocol}://${authString}${config.host}:${config.port}`;

  if (config.protocol === 'socks4' || config.protocol === 'socks5') {
    return new SocksProxyAgent(proxyUrl);
  } else {
    return new HttpsProxyAgent(proxyUrl);
  }
}

/**
 * Get proxy configuration from node parameters
 */
export function getProxyConfig(context: IExecuteFunctions, itemIndex: number): IProxyConfig | undefined {
  const proxySettings = context.getNodeParameter('proxySettings', itemIndex, {}) as any;

  if (!proxySettings.useProxy) {
    return undefined;
  }

  const proxyType = proxySettings.proxyType || 'http';
  const proxyHost = proxySettings.proxyHost || '';
  const proxyPort = proxySettings.proxyPort || 8080;
  const proxyAuth = proxySettings.proxyAuth || false;

  if (!proxyHost) {
    throw new Error('Proxy host is required when proxy is enabled');
  }

  const config: IProxyConfig = {
    protocol: proxyType as IProxyConfig['protocol'],
    host: proxyHost,
    port: proxyPort,
  };

  if (proxyAuth) {
    const proxyUsername = proxySettings.proxyUsername || '';
    const proxyPassword = proxySettings.proxyPassword || '';

    if (!proxyUsername || !proxyPassword) {
      throw new Error('Proxy username and password are required when proxy authentication is enabled');
    }

    config.auth = {
      username: proxyUsername,
      password: proxyPassword,
    };
  }

  return config;
}

/**
 * Apply proxy to HTTP request options
 */
export function applyProxyToRequest(
  options: IHttpRequestOptions,
  proxyConfig: IProxyConfig | undefined
): IHttpRequestOptions {
  if (!proxyConfig) {
    return options;
  }

  const agent = createProxyAgent(proxyConfig);

  return {
    ...options,
    agent,
    // Disable Node.js default proxy handling
    proxy: undefined,
  } as IHttpRequestOptions;
}

/**
 * Apply proxy to duck-duck-scrape options
 */
export function applyProxyToDDG(
  options: any,
  proxyConfig: IProxyConfig | undefined
): any {
  if (!proxyConfig) {
    return options;
  }

  const agent = createProxyAgent(proxyConfig);

  return {
    ...options,
    requestOptions: {
      ...options.requestOptions,
      agent,
    },
  };
}

/**
 * Test proxy connection
 */
export async function testProxyConnection(
  context: IExecuteFunctions,
  proxyConfig: IProxyConfig
): Promise<boolean> {
  try {
    const testUrl = 'https://api.duckduckgo.com/';

    const proxyOptions = applyProxyToRequest({
      method: 'GET',
      url: testUrl,
      timeout: 10000,
    }, proxyConfig);

    const response = await context.helpers.request(proxyOptions as any);

    return response !== undefined;
  } catch (error) {
    context.logger.error(`Proxy test failed: ${error.message}`);
    return false;
  }
}

/**
 * Get proxy status message
 */
export function getProxyStatusMessage(config: IProxyConfig): string {
  const authInfo = config.auth ? ' (authenticated)' : '';
  return `Using ${config.protocol.toUpperCase()} proxy: ${config.host}:${config.port}${authInfo}`;
}
