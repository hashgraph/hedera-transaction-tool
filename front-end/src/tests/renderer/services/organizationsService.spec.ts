import { describe, expect, test } from 'vitest';
import { getOrganizationWebsocketUrl } from '@renderer/services/organizationsService';

describe('getOrganizationWebsocketUrl', () => {
  test.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ])('uses the local notifications endpoint for loopback URL %s', serverUrl => {
    expect(getOrganizationWebsocketUrl(serverUrl)).toBe('ws://localhost:3020');
  });

  test.each([
    'https://tool.mylocalhosting.com:8443',
    'https://localhost.corp.example:8443',
    'https://org.example:8443/localhost',
  ])('preserves non-loopback URL %s', serverUrl => {
    expect(getOrganizationWebsocketUrl(serverUrl)).toBe(serverUrl);
  });

  test('preserves a loopback URL without an explicit port', () => {
    const serverUrl = 'http://localhost';

    expect(getOrganizationWebsocketUrl(serverUrl)).toBe(serverUrl);
  });
});
