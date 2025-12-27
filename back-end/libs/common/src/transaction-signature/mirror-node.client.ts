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

const RATE_LIMIT = {
  MAX_CONCURRENT: 10,
  DELAY_MS: 200, // 200ms delay between batches = ~50 req/sec with batch of 10
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
      const response = await this.getMirrorNodeData<AccountInfo>(url, etag);

      if (response.status === HTTP_STATUS.NOT_MODIFIED) {
        return { data: null, etag };
      }

      const accountInfoParsed = parseAccountInfo(response.data);
      const newEtag = response.etag ?? null;
      //or this?
      // const newEtag = (response.headers && (response.headers.etag ?? response.headers['etag'])) ?? null;

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
      const response = await this.getMirrorNodeData<NetworkNodesResponse>(url, etag);

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
      throw new HttpException(
        `Mirror node request failed: ${error.message}`,
        error.response?.status || HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  //TODO gotta implement this
  private async rateLimitedBatch<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
  ): Promise<void> {
    const chunks = this.chunkArray(items, RATE_LIMIT.MAX_CONCURRENT);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const promises = chunk.map(item =>
        operation(item).catch(error => {
          this.logger.error(`Batch operation failed: ${error.message}`);
          return null;
        })
      );

      await Promise.all(promises);

      // Delay between batches (except after last batch)
      if (i < chunks.length - 1) {
        await this.delay(RATE_LIMIT.DELAY_MS);
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}