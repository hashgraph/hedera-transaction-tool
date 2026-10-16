// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import {
  ActionStatus,
  makeGenericErrorReport,
  makeUncontrolledErrorReport,
} from '@renderer/components/ActionController/ActionReport';

const MIRROR_URL = 'https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.1';
const ORG_URL = 'https://org.example.com/transactions';

const config = (url: string) => ({ url }) as InternalAxiosRequestConfig;

// Request was sent but no response arrived (server down / DNS failure / refused)
const noResponseError = (url: string) =>
  new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED', config(url), {});

const responseError = (url: string, status: number) =>
  new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_RESPONSE',
    config(url),
    {},
    {
      status,
      statusText: 'error',
      headers: {},
      config: config(url),
      data: {},
    },
  );

describe('ActionReport - unreachable servers', () => {
  describe('14.4.3 Mirror Node unavailable', () => {
    test('reports mirror node unreachable when no response is received', () => {
      const report = makeGenericErrorReport(noResponseError(MIRROR_URL));

      expect(report).toMatchObject({
        status: ActionStatus.Error,
        what: 'Failed to contact mirror node',
        why: 'Mirror node is unreachable',
        next: 'Check your network connection',
      });
    });

    test('reports mirror node error on a 503 response', () => {
      const report = makeGenericErrorReport(responseError(MIRROR_URL, 503));

      expect(report).toMatchObject({
        status: ActionStatus.Error,
        what: 'Mirror node returned an error',
        why: 'Request failed with status code 503',
      });
    });

    test('reports mirror node overloaded on a 429 response', () => {
      const report = makeGenericErrorReport(responseError(MIRROR_URL, 429));

      expect(report).toMatchObject({
        what: 'Mirror node is overloaded',
        next: 'Try again later',
      });
    });

    test('makeUncontrolledErrorReport surfaces the mirror node report instead of a generic one', () => {
      const report = makeUncontrolledErrorReport(noResponseError(MIRROR_URL));

      expect(report.what).toBe('Failed to contact mirror node');
    });
  });

  describe('14.4.1 Organization server unreachable', () => {
    test('reports server unreachable when no response is received', () => {
      const report = makeGenericErrorReport(noResponseError(ORG_URL));

      expect(report).toMatchObject({
        status: ActionStatus.Error,
        what: 'Failed to contact server',
        why: 'Server is unreachable',
        next: 'Check your network connection',
      });
    });

    test('does not attribute an organization failure to the mirror node', () => {
      const report = makeGenericErrorReport(noResponseError(ORG_URL));

      expect(report?.what).not.toMatch(/mirror/i);
      expect(report?.why).not.toMatch(/mirror/i);
    });

    test('reports server error on a 500 response', () => {
      const report = makeGenericErrorReport(responseError(ORG_URL, 500));

      expect(report).toMatchObject({ what: 'Server returned an error' });
    });

    test('reports unexpected failure when the request was never made', () => {
      const report = makeGenericErrorReport(new AxiosError('bad config', 'ERR_BAD_OPTION'));

      expect(report).toMatchObject({
        what: 'Unexpected Network failure',
        why: 'bad config',
      });
    });
  });
});
