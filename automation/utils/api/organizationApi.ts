import axios, { AxiosError, AxiosInstance } from 'axios';
import * as https from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Memoized so the package.json read happens at most once per process, but
// only on the first request that actually needs the header — a misconfigured
// checkout no longer fails module import for every consumer.
let cachedFrontendVersionHeader: string | undefined;

function getFrontendVersionHeader(): string {
  if (cachedFrontendVersionHeader !== undefined) {
    return cachedFrontendVersionHeader;
  }

  const override = process.env.FRONTEND_VERSION_HEADER;
  if (override && override.trim().length > 0) {
    const trimmed = override.trim();
    cachedFrontendVersionHeader = trimmed;
    return trimmed;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const frontendPackageJsonPath = resolve(here, '../../../front-end/package.json');

  try {
    const pkg = JSON.parse(readFileSync(frontendPackageJsonPath, 'utf-8'));
    if (typeof pkg.version === 'string' && pkg.version.length > 0) {
      cachedFrontendVersionHeader = pkg.version;
      return pkg.version;
    }
    throw new Error(`No "version" field in ${frontendPackageJsonPath}`);
  } catch (error) {
    throw new Error(
      `Could not determine x-frontend-version header from ${frontendPackageJsonPath}. ` +
        `Set FRONTEND_VERSION_HEADER env var to override. Cause: ${(error as Error).message}`,
    );
  }
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export type SignatureMapPayload = Record<
  string,
  Record<string, Record<string, string>>
>;

export interface SignaturePayload {
  id: number;
  signatureMap: SignatureMapPayload;
}

export interface OrganizationTransaction {
  id: number;
  transactionId: string;
  transactionBytes: Buffer;
}

function getOrganizationApiBaseUrl(): string {
  const url = process.env.ORGANIZATION_URL;
  if (!url) {
    throw new Error(
      'ORGANIZATION_URL env var is not set — required for the organization API client.',
    );
  }
  return url.replace(/\/$/, '');
}

function createClient(token?: string): AxiosInstance {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-frontend-version': getFrontendVersionHeader(),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return axios.create({
    baseURL: getOrganizationApiBaseUrl(),
    httpsAgent,
    headers,
    validateStatus: status => status >= 200 && status < 300,
  });
}

function describeAxiosError(error: unknown, context: string): Error {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status ?? 'no-status';
    const body =
      typeof axiosError.response?.data === 'string'
        ? axiosError.response.data
        : JSON.stringify(axiosError.response?.data ?? {});
    return new Error(`${context} failed: HTTP ${status} ${body}`);
  }
  return error instanceof Error ? error : new Error(`${context} failed: ${String(error)}`);
}

export async function loginToOrganizationApi(
  email: string,
  password: string,
): Promise<string> {
  try {
    const response = await createClient().post('/auth/login', { email, password });
    const token = response.data?.accessToken;
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error(`No accessToken returned in /auth/login response for ${email}`);
    }
    return token;
  } catch (error) {
    throw describeAxiosError(error, `loginToOrganizationApi(${email})`);
  }
}

export async function getOrganizationTransactionByHederaId(
  token: string,
  hederaTxId: string,
): Promise<OrganizationTransaction> {
  try {
    const encoded = encodeURIComponent(hederaTxId);
    const response = await createClient(token).get(`/transactions/${encoded}`);
    const data = response.data;
    if (typeof data?.id !== 'number' || typeof data?.transactionBytes !== 'string') {
      throw new Error(
        `Unexpected response shape for /transactions/${hederaTxId}: ${JSON.stringify(data)}`,
      );
    }
    return {
      id: data.id,
      transactionId: data.transactionId,
      transactionBytes: Buffer.from(data.transactionBytes, 'hex'),
    };
  } catch (error) {
    throw describeAxiosError(error, `getOrganizationTransactionByHederaId(${hederaTxId})`);
  }
}

export interface UploadSignaturesResponse {
  signers: Array<{ id: number; transactionId: number; userKeyId: number }>;
  notificationReceiverIds: number[];
}

export async function uploadOrganizationSignatures(
  token: string,
  payloads: SignaturePayload[],
): Promise<UploadSignaturesResponse> {
  try {
    const response = await createClient(token).post(
      '/transactions/signers?includeNotifications=true',
      payloads,
    );
    return response.data as UploadSignaturesResponse;
  } catch (error) {
    throw describeAxiosError(error, `uploadOrganizationSignatures(${payloads.length} payload(s))`);
  }
}
