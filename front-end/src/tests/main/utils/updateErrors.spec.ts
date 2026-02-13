import { describe, it, expect } from 'vitest';

import { categorizeUpdateError } from '@main/utils/updateErrors';

describe('categorizeUpdateError', () => {
  describe('network errors', () => {
    it('should categorize "network" keyword as network error', () => {
      const error = new Error('Network error occurred');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
      expect(result.message).toBe('No internet connection or the server could not be reached.');
      expect(result.details).toContain('Network error occurred');
    });

    it('should categorize "timeout" keyword as network error', () => {
      const error = new Error('Request timeout');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
    });

    it('should categorize "dns" keyword as network error', () => {
      const error = new Error('DNS lookup failed');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
    });

    it('should categorize ENOTFOUND as network error', () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
    });

    it('should categorize ETIMEDOUT as network error', () => {
      const error = new Error('connect ETIMEDOUT 192.168.1.1:443');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
    });

    it('should categorize EAI_AGAIN as network error', () => {
      const error = new Error('getaddrinfo EAI_AGAIN');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
    });

    it('should categorize NetworkError by name as network error', () => {
      const error = new Error('Failed to fetch');
      error.name = 'NetworkError';
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
    });
  });

  describe('connection-refused errors', () => {
    it('should categorize "connection refused" as connection-refused error', () => {
      const error = new Error('connection refused');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
      expect(result.message).toBe(
        'The update server could not be reached (connection refused or blocked).',
      );
    });

    it('should categorize ECONNREFUSED as connection-refused error', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
    });

    it('should categorize "forbidden" as connection-refused error', () => {
      const error = new Error('Forbidden: Access denied');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
    });

    it('should categorize "403" status as connection-refused error', () => {
      const error = new Error('HTTP Error 403');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
    });

    it('should categorize "blocked" keyword as connection-refused error', () => {
      const error = new Error('Request blocked by firewall');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
    });

    it('should categorize "firewall" keyword as connection-refused error', () => {
      const error = new Error('Firewall rejected the connection');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
    });

    it('should categorize "proxy" keyword as connection-refused error', () => {
      const error = new Error('Proxy authentication required');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
    });
  });

  describe('invalid-url errors', () => {
    it('should categorize "invalid url" as invalid-url error', () => {
      const error = new Error('Invalid URL provided');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
      expect(result.message).toBe('The update URL is invalid or misconfigured.');
    });

    it('should categorize "malformed" as invalid-url error', () => {
      const error = new Error('Malformed response received');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
    });

    it('should categorize "404" status as invalid-url error', () => {
      const error = new Error('HTTP Error 404');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
    });

    it('should categorize "not found" as invalid-url error', () => {
      const error = new Error('Resource not found');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
    });

    it('should categorize "feed" keyword as invalid-url error', () => {
      const error = new Error('Failed to parse feed');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
    });

    it('should categorize "update info" keyword as invalid-url error', () => {
      const error = new Error('Cannot read update info');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
    });

    it('should categorize TypeError by name as invalid-url error', () => {
      const error = new TypeError('Cannot read properties of undefined');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
    });

    it('should categorize SyntaxError by name as invalid-url error', () => {
      const error = new SyntaxError('Unexpected token in JSON');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('invalid-url');
    });
  });

  describe('generic errors', () => {
    it('should categorize unknown errors as generic', () => {
      const error = new Error('Something unexpected happened');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('generic');
      expect(result.message).toBe('An error occurred while updating.');
      expect(result.details).toContain('Something unexpected happened');
    });

    it('should categorize empty error message as generic', () => {
      const error = new Error('');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('generic');
    });

    it('should include stack trace in details when available', () => {
      const error = new Error('Test error');
      const result = categorizeUpdateError(error);

      expect(result.details).toContain('Error: Test error');
    });
  });

  describe('string errors', () => {
    it('should handle string input for network error', () => {
      const result = categorizeUpdateError('Network connection lost');

      expect(result.type).toBe('network');
      expect(result.details).toBe('Network connection lost');
    });

    it('should handle string input for connection-refused error', () => {
      const result = categorizeUpdateError('ECONNREFUSED');

      expect(result.type).toBe('connection-refused');
    });

    it('should handle string input for invalid-url error', () => {
      const result = categorizeUpdateError('404 Not Found');

      expect(result.type).toBe('invalid-url');
    });

    it('should handle string input for generic error', () => {
      const result = categorizeUpdateError('Unknown error');

      expect(result.type).toBe('generic');
      expect(result.details).toBe('Unknown error');
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase error messages', () => {
      const error = new Error('NETWORK ERROR');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('network');
    });

    it('should handle mixed case error messages', () => {
      const error = new Error('Connection Refused By Server');
      const result = categorizeUpdateError(error);

      expect(result.type).toBe('connection-refused');
    });
  });
});

