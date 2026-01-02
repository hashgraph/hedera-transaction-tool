import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';

import { MirrorNodeClient } from './mirror-node.client';

import {
  parseAccountInfo,
  parseNodeInfo,
  MirrorNodeREST,
} from '@app/common';

jest.mock('@app/common', () => ({
  parseAccountInfo: jest.fn(),
  parseNodeInfo: jest.fn(),
  MirrorNodeREST: {
    fromBaseURL: jest.fn(),
  },
}));

const originalMathMin = Math.min;

describe('MirrorNodeClient', () => {
  let client: MirrorNodeClient;

  const axiosGet = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    (MirrorNodeREST.fromBaseURL as jest.Mock).mockReturnValue('https://mirror.test');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MirrorNodeClient,
        ConfigService,
        {
          provide: HttpService,
          useValue: {
            axiosRef: {
              get: axiosGet,
            },
          },
        },
      ],
    }).compile();

    client = module.get(MirrorNodeClient);

    jest.spyOn(Math, 'min').mockReturnValue(0);
  });

  /* ------------------------------------------------------------------
   * fetchAccountInfo
   * ------------------------------------------------------------------ */

  describe('fetchAccountInfo', () => {
    it('should return parsed account info on 200', async () => {
      (parseAccountInfo as jest.Mock).mockReturnValue({ parsed: true });

      axiosGet.mockResolvedValue({
        status: 200,
        data: { raw: true },
        headers: { etag: 'new-etag' },
      });

      const result = await client.fetchAccountInfo('0.0.1', 'testnet');

      expect(result).toEqual({
        data: { parsed: true },
        etag: 'new-etag',
      });
    });

    it('should return null data on 304', async () => {
      axiosGet.mockResolvedValue({
        status: 304,
        data: null,
        headers: {},
      });

      const result = await client.fetchAccountInfo('0.0.1', 'testnet', 'etag');

      expect(result).toEqual({
        data: null,
        etag: 'etag',
      });
    });

    it('should return null etag when not present in response', async () => {
      (parseAccountInfo as jest.Mock).mockReturnValue({ parsed: true });

      axiosGet.mockResolvedValue({
        status: 200,
        data: { raw: true },
        headers: {},
      });

      const result = await client.fetchAccountInfo('0.0.1', 'testnet');

      expect(result.etag).toBeNull();
    });

    it('should rethrow error after max retries', async () => {
      axiosGet.mockRejectedValue(
        Object.assign(new Error('boom'), { response: { status: 500 } })
      );

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      await expect(promise).rejects.toThrow('Mirror node request failed: boom');
      expect(axiosGet).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });
  });

  /* ------------------------------------------------------------------
   * fetchNodeInfo
   * ------------------------------------------------------------------ */

  describe('fetchNodeInfo', () => {
    it('should return parsed node info on 200', async () => {
      (parseNodeInfo as jest.Mock).mockReturnValue({ parsedNode: true });

      axiosGet.mockResolvedValue({
        status: 200,
        data: { nodes: [{ id: 1 }] },
        headers: { etag: 'etag2' },
      });

      const result = await client.fetchNodeInfo(1, 'testnet');

      expect(result).toEqual({
        data: { parsedNode: true },
        etag: 'etag2',
      });
    });

    it('should return null on 304', async () => {
      axiosGet.mockResolvedValue({
        status: 304,
        data: null,
        headers: {},
      });

      const result = await client.fetchNodeInfo(1, 'testnet', 'etag');

      expect(result).toEqual({
        data: null,
        etag: 'etag',
      });
    });

    it('should return null when node list is empty', async () => {
      axiosGet.mockResolvedValue({
        status: 200,
        data: { nodes: [] },
        headers: {},
      });

      const result = await client.fetchNodeInfo(1, 'testnet');

      expect(result).toEqual({
        data: null,
        etag: null,
      });
    });

    it('should return null when nodes is undefined', async () => {
      axiosGet.mockResolvedValue({
        status: 200,
        data: {},
        headers: {},
      });

      const result = await client.fetchNodeInfo(1, 'testnet');

      expect(result).toEqual({
        data: null,
        etag: null,
      });
    });

    it('should return null etag when not present in response', async () => {
      (parseNodeInfo as jest.Mock).mockReturnValue({ parsedNode: true });

      axiosGet.mockResolvedValue({
        status: 200,
        data: { nodes: [{ id: 1 }] },
        headers: {},
      });

      const result = await client.fetchNodeInfo(1, 'testnet');

      expect(result.etag).toBeNull();
    });

    it('should rethrow error after max retries', async () => {
      axiosGet.mockRejectedValue(new Error('node error'));

      const promise = client.fetchNodeInfo(1, 'testnet');

      await expect(promise).rejects.toThrow('Mirror node request failed: node error');
    });
  });

  /* ------------------------------------------------------------------
   * Retry logic
   * ------------------------------------------------------------------ */

  describe('retry logic', () => {
    it('should retry on retryable error and eventually succeed', async () => {
      axiosGet
        .mockRejectedValueOnce({ response: { status: 500 }, message: 'Server error' })
        .mockResolvedValueOnce({
          status: 200,
          data: { raw: true },
          headers: {},
        });

      (parseAccountInfo as jest.Mock).mockReturnValue({ ok: true });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const result = await promise;

      expect(result.data).toEqual({ ok: true });
      expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max retries', async () => {
      axiosGet.mockRejectedValue({
        response: { status: 500 },
        message: 'Server error'
      });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      await expect(promise).rejects.toBeDefined();

      expect(axiosGet).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });

    it('should not retry on non-retryable 4xx error', async () => {
      axiosGet.mockRejectedValue({
        response: { status: 400 },
        message: 'bad request',
      });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      await expect(promise).rejects.toBeDefined();

      expect(axiosGet).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 rate limit error', async () => {
      axiosGet
        .mockRejectedValueOnce({
          response: { status: 429 },
          message: 'Rate limited'
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { raw: true },
          headers: {},
        });

      (parseAccountInfo as jest.Mock).mockReturnValue({ ok: true });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const result = await promise;

      expect(result.data).toEqual({ ok: true });
      expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('should retry on ECONNREFUSED network error', async () => {
      axiosGet
        .mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'Connection refused' })
        .mockResolvedValueOnce({
          status: 200,
          data: { raw: true },
          headers: {},
        });

      (parseAccountInfo as jest.Mock).mockReturnValue({ ok: true });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const result = await promise;

      expect(result.data).toEqual({ ok: true });
      expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('should retry on ETIMEDOUT network error', async () => {
      axiosGet
        .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'Timeout' })
        .mockResolvedValueOnce({
          status: 200,
          data: { raw: true },
          headers: {},
        });

      (parseAccountInfo as jest.Mock).mockReturnValue({ ok: true });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const result = await promise;

      expect(result.data).toEqual({ ok: true });
    });

    it('should retry on ENOTFOUND network error', async () => {
      axiosGet
        .mockRejectedValueOnce({ code: 'ENOTFOUND', message: 'Not found' })
        .mockResolvedValueOnce({
          status: 200,
          data: { raw: true },
          headers: {},
        });

      (parseAccountInfo as jest.Mock).mockReturnValue({ ok: true });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const result = await promise;

      expect(result.data).toEqual({ ok: true });
    });

    it('should retry on unknown errors by default', async () => {
      axiosGet
        .mockRejectedValueOnce({ message: 'Unknown error' })
        .mockResolvedValueOnce({
          status: 200,
          data: { raw: true },
          headers: {},
        });

      (parseAccountInfo as jest.Mock).mockReturnValue({ ok: true });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const result = await promise;

      expect(result.data).toEqual({ ok: true });
      expect(axiosGet).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 404 error', async () => {
      axiosGet.mockRejectedValue({
        response: { status: 404 },
        message: 'Not found',
      });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      await expect(promise).rejects.toBeDefined();

      expect(axiosGet).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 403 error', async () => {
      axiosGet.mockRejectedValue({
        response: { status: 403 },
        message: 'Forbidden',
      });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      await expect(promise).rejects.toBeDefined();

      expect(axiosGet).toHaveBeenCalledTimes(1);
    });
  });

  /* ------------------------------------------------------------------
   * HTTP exception wrapping
   * ------------------------------------------------------------------ */

  describe('HTTP exception wrapping', () => {
    it('should wrap errors in HttpException', async () => {
      axiosGet.mockRejectedValue({
        message: 'axios failed',
        response: { status: 503 },
      });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const error = await promise.catch(e => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.message).toBe('Mirror node request failed: axios failed');
      expect(error.getStatus()).toBe(503);
    });

    it('should use SERVICE_UNAVAILABLE status when no response status', async () => {
      axiosGet.mockRejectedValue({
        message: 'network error',
      });

      const promise = client.fetchAccountInfo('0.0.1', 'testnet');

      const error = await promise.catch(e => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  /* ------------------------------------------------------------------
   * calculateBackoffDelay
   * ------------------------------------------------------------------ */

  describe('calculateBackoffDelay', () => {
    beforeEach(() => {
      // Restore real Math.min just for this block
      (Math as any).min = originalMathMin;
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // predictable jitter
    });

    afterEach(() => {
      jest.spyOn(Math, 'random').mockRestore();
    });

    it('should calculate exponential backoff with jitter', () => {
      const delay1 = (client as any).calculateBackoffDelay(1);
      const delay2 = (client as any).calculateBackoffDelay(2);
      const delay3 = (client as any).calculateBackoffDelay(3);

      // First attempt: 1000 * 2^0 = 1000ms (base)
      expect(delay1).toBeGreaterThanOrEqual(750); // 1000 - 25%
      expect(delay1).toBeLessThanOrEqual(1250);   // 1000 + 25%

      // Second attempt: 1000 * 2^1 = 2000ms (base)
      expect(delay2).toBeGreaterThanOrEqual(1500);
      expect(delay2).toBeLessThanOrEqual(2500);

      // Third attempt: 1000 * 2^2 = 4000ms (base)
      expect(delay3).toBeGreaterThanOrEqual(3000);
      expect(delay3).toBeLessThanOrEqual(5000);
    });

    it('should cap delay at MAX_DELAY_MS', () => {
      // Attempt that would exceed max: 1000 * 2^10 = 1,024,000ms
      const delay = (client as any).calculateBackoffDelay(10);

      // Should be capped at 10000ms + jitter
      expect(delay).toBeLessThanOrEqual(12500); // 10000 + 25%
    });
  });

  /* ------------------------------------------------------------------
   * isRetryableError
   * ------------------------------------------------------------------ */

  describe('isRetryableError', () => {
    it('should return true for 500 error', () => {
      const result = (client as any).isRetryableError({
        response: { status: 500 },
      });
      expect(result).toBe(true);
    });

    it('should return true for 503 error', () => {
      const result = (client as any).isRetryableError({
        response: { status: 503 },
      });
      expect(result).toBe(true);
    });

    it('should return true for 429 error', () => {
      const result = (client as any).isRetryableError({
        response: { status: 429 },
      });
      expect(result).toBe(true);
    });

    it('should return false for 400 error', () => {
      const result = (client as any).isRetryableError({
        response: { status: 400 },
      });
      expect(result).toBe(false);
    });

    it('should return false for 404 error', () => {
      const result = (client as any).isRetryableError({
        response: { status: 404 },
      });
      expect(result).toBe(false);
    });

    it('should return true for ECONNREFUSED', () => {
      const result = (client as any).isRetryableError({
        code: 'ECONNREFUSED',
      });
      expect(result).toBe(true);
    });

    it('should return true for ETIMEDOUT', () => {
      const result = (client as any).isRetryableError({
        code: 'ETIMEDOUT',
      });
      expect(result).toBe(true);
    });

    it('should return true for ENOTFOUND', () => {
      const result = (client as any).isRetryableError({
        code: 'ENOTFOUND',
      });
      expect(result).toBe(true);
    });

    it('should return true for unknown errors', () => {
      const result = (client as any).isRetryableError({
        message: 'Unknown error',
      });
      expect(result).toBe(true);
    });

    it('should return true when no response or code', () => {
      const result = (client as any).isRetryableError({});
      expect(result).toBe(true);
    });
  });

  /* ------------------------------------------------------------------
   * getMirrorNodeRESTURL
   * ------------------------------------------------------------------ */

  describe('getMirrorNodeRESTURL', () => {
    it('should construct URL correctly', () => {
      const url = (client as any).getMirrorNodeRESTURL('testnet');
      expect(url).toBe('https://mirror.test/api/v1');
      expect(MirrorNodeREST.fromBaseURL).toHaveBeenCalledWith('testnet');
    });
  });

  /* ------------------------------------------------------------------
   * getMirrorNodeData
   * ------------------------------------------------------------------ */

  describe('getMirrorNodeData', () => {
    it('should include If-None-Match header when etag provided', async () => {
      axiosGet.mockResolvedValue({
        status: 200,
        data: { test: true },
        headers: {},
      });

      await (client as any).getMirrorNodeData('http://test.url', 'test-etag');

      expect(axiosGet).toHaveBeenCalledWith('http://test.url', {
        headers: { 'If-None-Match': 'test-etag' },
        validateStatus: expect.any(Function),
      });
    });

    it('should not include If-None-Match header when no etag', async () => {
      axiosGet.mockResolvedValue({
        status: 200,
        data: { test: true },
        headers: {},
      });

      await (client as any).getMirrorNodeData('http://test.url');

      expect(axiosGet).toHaveBeenCalledWith('http://test.url', {
        headers: {},
        validateStatus: expect.any(Function),
      });
    });

    it('should accept 200 status', async () => {
      axiosGet.mockResolvedValue({
        status: 200,
        data: { test: true },
        headers: {},
      });

      const result = await (client as any).getMirrorNodeData('http://test.url');

      expect(result.status).toBe(200);
    });

    it('should accept 304 status when etag provided', async () => {
      axiosGet.mockResolvedValue({
        status: 304,
        data: null,
        headers: {},
      });

      const result = await (client as any).getMirrorNodeData('http://test.url', 'etag');

      expect(result.status).toBe(304);
    });
  });

  /* ------------------------------------------------------------------
   * delay
   * ------------------------------------------------------------------ */

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      jest.useFakeTimers();

      const delayPromise = (client as any).delay(1000);

      jest.advanceTimersByTime(999);
      await Promise.resolve(); // Flush microtasks

      jest.advanceTimersByTime(1);
      await delayPromise;

      // If we get here without hanging, the delay worked
      expect(true).toBe(true);

      jest.useRealTimers();
    });
  });
});