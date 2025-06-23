import {
  parseProxyUrl,
  createProxyAgent,
  getProxyConfig,
  applyProxyToRequest,
  applyProxyToDDG,
  getProxyStatusMessage,
} from '../proxy';
import { IExecuteFunctions } from 'n8n-workflow';

const mockContext = {
  getNodeParameter: jest.fn(),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as IExecuteFunctions;

describe('Proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseProxyUrl', () => {
    it('should parse HTTP proxy URL without auth', () => {
      const config = parseProxyUrl('http://proxy.example.com:8080');

      expect(config).toEqual({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
      });
    });

    it('should parse HTTPS proxy URL with auth', () => {
      const config = parseProxyUrl('https://user:pass@proxy.example.com:443');

      expect(config).toEqual({
        protocol: 'https',
        host: 'proxy.example.com',
        port: 443,
        auth: {
          username: 'user',
          password: 'pass',
        },
      });
    });

    it('should parse SOCKS5 proxy URL', () => {
      const config = parseProxyUrl('socks5://localhost:1080');

      expect(config).toEqual({
        protocol: 'socks5',
        host: 'localhost',
        port: 1080,
      });
    });

    it('should use default port when not specified', () => {
      const httpConfig = parseProxyUrl('http://proxy.example.com');
      const socksConfig = parseProxyUrl('socks5://proxy.example.com');

      expect(httpConfig.port).toBe(8080);
      expect(socksConfig.port).toBe(1080);
    });

    it('should handle URL-encoded credentials', () => {
      const config = parseProxyUrl('http://user%40example.com:pass%23word@proxy.example.com:8080');

      expect(config.auth).toEqual({
        username: 'user@example.com',
        password: 'pass#word',
      });
    });

    it('should throw error for invalid proxy URL', () => {
      expect(() => parseProxyUrl('invalid-url')).toThrow('Invalid proxy URL');
    });

    it('should throw error for unsupported protocol', () => {
      expect(() => parseProxyUrl('ftp://proxy.example.com:21')).toThrow('Unsupported proxy protocol: ftp');
    });
  });

  describe('createProxyAgent', () => {
    it('should create HTTP proxy agent', () => {
      const config = {
        protocol: 'http' as const,
        host: 'proxy.example.com',
        port: 8080,
      };

      const agent = createProxyAgent(config);
      expect(agent).toBeDefined();
    });

    it('should create SOCKS proxy agent', () => {
      const config = {
        protocol: 'socks5' as const,
        host: 'proxy.example.com',
        port: 1080,
      };

      const agent = createProxyAgent(config);
      expect(agent).toBeDefined();
    });
  });

    describe('getProxyConfig', () => {
    it('should return undefined when proxy is disabled', () => {
      mockContext.getNodeParameter = jest.fn((name, itemIndex, defaultValue) => {
        if (name === 'proxySettings') return { useProxy: false };
        return defaultValue;
      }) as any;

      const config = getProxyConfig(mockContext, 0);
      expect(config).toBeUndefined();
    });

        it('should get proxy config without auth', () => {
      mockContext.getNodeParameter = jest.fn((name, itemIndex, defaultValue) => {
        if (name === 'proxySettings') {
          return {
            useProxy: true,
            proxyType: 'http',
            proxyHost: 'proxy.example.com',
            proxyPort: 8080,
            proxyAuth: false,
          };
        }
        return defaultValue;
      }) as any;

      const config = getProxyConfig(mockContext, 0);
      expect(config).toEqual({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
      });
    });

    it('should get proxy config with auth', () => {
      mockContext.getNodeParameter = jest.fn((name, itemIndex, defaultValue) => {
        if (name === 'proxySettings') {
          return {
            useProxy: true,
            proxyType: 'socks5',
            proxyHost: 'proxy.example.com',
            proxyPort: 1080,
            proxyAuth: true,
            proxyUsername: 'user',
            proxyPassword: 'pass',
          };
        }
        return defaultValue;
      }) as any;

      const config = getProxyConfig(mockContext, 0);
      expect(config).toEqual({
        protocol: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        auth: {
          username: 'user',
          password: 'pass',
        },
      });
    });

    it('should throw error when proxy host is missing', () => {
      mockContext.getNodeParameter = jest.fn((name) => {
        if (name === 'proxySettings') {
          return {
            useProxy: true,
            proxyHost: '',
          };
        }
        return {};
      }) as any;

      expect(() => getProxyConfig(mockContext, 0)).toThrow('Proxy host is required');
    });

    it('should throw error when auth credentials are missing', () => {
      mockContext.getNodeParameter = jest.fn((name) => {
        if (name === 'proxySettings') {
          return {
            useProxy: true,
            proxyHost: 'proxy.example.com',
            proxyAuth: true,
            proxyUsername: '',
            proxyPassword: 'pass',
          };
        }
        return {};
      }) as any;

      expect(() => getProxyConfig(mockContext, 0)).toThrow('Proxy username and password are required');
    });
  });

  describe('applyProxyToRequest', () => {
    it('should return options unchanged when no proxy', () => {
      const options = { url: 'https://example.com' };
      const result = applyProxyToRequest(options, undefined);

      expect(result).toEqual(options);
    });

    it('should add agent to request options', () => {
      const options = { url: 'https://example.com' };
      const proxyConfig = {
        protocol: 'http' as const,
        host: 'proxy.example.com',
        port: 8080,
      };

      const result = applyProxyToRequest(options, proxyConfig);

      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('proxy', undefined);
    });
  });

  describe('applyProxyToDDG', () => {
    it('should return options unchanged when no proxy', () => {
      const options = { locale: 'en-us' };
      const result = applyProxyToDDG(options, undefined);

      expect(result).toEqual(options);
    });

    it('should add agent to DDG options', () => {
      const options = { locale: 'en-us' };
      const proxyConfig = {
        protocol: 'http' as const,
        host: 'proxy.example.com',
        port: 8080,
      };

      const result = applyProxyToDDG(options, proxyConfig);

      expect(result).toHaveProperty('requestOptions.agent');
    });
  });

  describe('getProxyStatusMessage', () => {
    it('should return status message without auth', () => {
      const config = {
        protocol: 'http' as const,
        host: 'proxy.example.com',
        port: 8080,
      };

      const message = getProxyStatusMessage(config);
      expect(message).toBe('Using HTTP proxy: proxy.example.com:8080');
    });

    it('should return status message with auth', () => {
      const config = {
        protocol: 'socks5' as const,
        host: 'proxy.example.com',
        port: 1080,
        auth: {
          username: 'user',
          password: 'pass',
        },
      };

      const message = getProxyStatusMessage(config);
      expect(message).toBe('Using SOCKS5 proxy: proxy.example.com:1080 (authenticated)');
    });
  });
});
