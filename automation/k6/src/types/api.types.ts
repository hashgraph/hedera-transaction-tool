/**
 * API Response Types
 *
 * Types for backend API responses used in k6 performance tests.
 */

/**
 * Authentication response from /auth/login
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user?: {
    id: number;
    email: string;
    admin: boolean;
  };
}

/**
 * Transaction entity from API
 */
export interface Transaction {
  id: number;
  transactionId?: string;
  name: string;
  description?: string;
  status: TransactionStatus;
  transactionBytes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transaction status enum values
 */
export type TransactionStatus =
  | 'NEW'
  | 'WAITING FOR SIGNATURES'
  | 'WAITING FOR EXECUTION'
  | 'EXECUTED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELED';

/**
 * Transaction to sign DTO from /transactions/sign endpoint
 * Wraps Transaction with keysToSign metadata
 */
export interface TransactionToSignDto {
  transaction: Transaction;
  keysToSign: number[];
}

/**
 * Paginated API response wrapper
 * Matches backend PaginatedResourceDto
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  page: number;
  size: number;
}

/**
 * HTTP request headers with authorization
 */
export interface AuthHeaders {
  headers: {
    'Content-Type': string;
    Authorization: string;
    'x-frontend-version'?: string;
  };
}

/**
 * Backend signature map structure
 * nodeAccountId -> transactionId -> publicKey -> signature (hex with 0x prefix)
 */
export interface SignatureMap {
  [nodeAccountId: string]: {
    [transactionId: string]: {
      [publicKey: string]: string;
    };
  };
}

/**
 * Pre-signed transaction from signature helper
 */
export interface PreSignedTransaction {
  signatureMap: SignatureMap;
}

/**
 * Pre-signed data loaded from signatures file
 * signaturesByTxId is keyed by Hedera transactionId string (not numeric DB id)
 */
export interface PreSignedData {
  count?: number;
  signatureCount?: number;
  signatures?: SignatureMap[]; // Legacy array format (index-based)
  signaturesByTxId?: Record<string, SignatureMap>; // Keyed by transactionId string
  transactions?: PreSignedTransaction[];
}
