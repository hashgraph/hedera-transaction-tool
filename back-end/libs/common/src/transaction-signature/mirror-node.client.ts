import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import {
  AccountInfo,
  AccountInfoParsed,
  MirrorNodeREST,
  NetworkNodesResponse,
  NodeInfoParsed,
  parseAccountInfo,
  parseNodeInfo,
} from '@app/common';

const HTTP_STATUS = {
  OK: 200,
  NOT_MODIFIED: 304,
} as const;

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000, // Start with 1 second
  MAX_DELAY_MS: 10000, // Cap at 10 seconds
  BACKOFF_MULTIPLIER: 2,
} as const;

export interface HttpResult<T> {
  status: number;
  data: T;
  etag?: string;
}

@Injectable()
export class MirrorNodeClient {
  private readonly logger = new Logger(MirrorNodeClient.name);
  private readonly endpointPrefix = '/api/v1';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Fetch account info from mirror node
   */
  async fetchAccountInfo(
    accountId: string,
    mirrorNetwork: string,
    etag?: string,
  ): Promise<{ data: AccountInfoParsed | null; etag: string | null }> {
    const url = `${this.getMirrorNodeRESTURL(mirrorNetwork)}/accounts/${accountId}`;

    try {
      const response = await this.fetchWithRetry<AccountInfo>(url, etag);

      if (response.status === HTTP_STATUS.NOT_MODIFIED) {
        return { data: null, etag };
      }

      const accountInfoParsed = parseAccountInfo(response.data);
      const newEtag = response.etag ?? null;

      return { data: accountInfoParsed, etag: newEtag };
    } catch (error) {
      this.logger.error(`Failed to fetch account ${accountId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch node info from mirror node
   */
  async fetchNodeInfo(
    nodeId: number,
    mirrorNetwork: string,
    etag?: string,
  ): Promise<{ data: NodeInfoParsed | null; etag: string | null }> {
    const url = `${this.getMirrorNodeRESTURL(mirrorNetwork)}/network/nodes?node.id=eq:${nodeId}`;

    try {
      const response = await this.fetchWithRetry<NetworkNodesResponse>(url, etag);

      if (response.status === HTTP_STATUS.NOT_MODIFIED) {
        return { data: null, etag: etag };
      }

      const nodeResponse = response.data;
      if (!nodeResponse.nodes || nodeResponse.nodes.length === 0) {
        this.logger.warn(`No node found with id: ${nodeId}`);
        return { data: null, etag: null };
      }

      const nodeInfoParsed = parseNodeInfo(nodeResponse.nodes[0]);
      const newEtag = response.etag ?? null;

      return { data: nodeInfoParsed, etag: newEtag };
    } catch (error) {
      this.logger.error(`Failed to fetch node ${nodeId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch data with exponential backoff retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    etag?: string,
    attempt = 1,
  ): Promise<HttpResult<T>> {
    try {
      return await this.getMirrorNodeData<T>(url, etag);
    } catch (error) {
      const shouldRetry = this.isRetryableError(error);

      if (!shouldRetry || attempt >= RETRY_CONFIG.MAX_RETRIES) {
        this.logger.error(
          `Request failed after ${attempt} attempt(s) for ${url}: ${error.message}`
        );
        throw new HttpException(
          `Mirror node request failed: ${error.message}`,
          error.response?.status || HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const delay = this.calculateBackoffDelay(attempt);
      this.logger.warn(
        `Request failed (attempt ${attempt}/${RETRY_CONFIG.MAX_RETRIES}), ` +
        `retrying in ${delay}ms: ${error.message}`
      );

      await this.delay(delay);
      return this.fetchWithRetry<T>(url, etag, attempt + 1);
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1),
      RETRY_CONFIG.MAX_DELAY_MS
    );

    // Add jitter (±25% randomization) to prevent thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Don't retry client errors (4xx) except 429 (rate limit)
    if (error.response?.status) {
      const status = error.response.status;

      // Retry on rate limits and server errors
      if (status === 429 || status >= 500) {
        return true;
      }

      // Don't retry other 4xx errors
      if (status >= 400 && status < 500) {
        return false;
      }
    }

    // Retry on network errors (ECONNREFUSED, ETIMEDOUT, etc.)
    if (error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND') {
      return true;
    }

    // Default to retrying for unknown errors
    return true;
  }

  private getMirrorNodeRESTURL(mirrorNetwork: string): string {
    return `${MirrorNodeREST.fromBaseURL(mirrorNetwork)}${this.endpointPrefix}`;
  }

  private async getMirrorNodeData<T>(
    url: string,
    etag?: string,
  ): Promise<HttpResult<T>> {
    const headers: Record<string, string> = {};
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    try {
      const response = await this.httpService.axiosRef.get<T>(url, {
        headers,
        validateStatus: (status) =>
          status === HTTP_STATUS.OK ||
          // only accept NOT_MODIFIED if we actually sent an ETag
          (etag != null && status === HTTP_STATUS.NOT_MODIFIED),
      });

      return {
        status: response.status,
        data: response.data,
        etag: response.headers?.etag,
      };
    } catch (error) {
      this.logger.error(`HTTP request failed for ${url}: ${error.message}`);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}