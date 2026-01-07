/**
 * Node.js helper script for pre-signing transactions
 *
 * This runs in Node.js (not k6) because k6 cannot use @hashgraph/sdk.
 * Run this before k6 tests to generate signature files.
 *
 * Usage:
 *   npx tsx sign-transactions.ts <transaction.tx> <output.json> <privateKey1> [privateKey2] ...
 *
 * Or programmatically:
 *   import { signTransaction, signMultipleTransactions } from './sign-transactions';
 */

import fs from 'fs';
import path from 'path';
import { Transaction, PrivateKey } from '@hashgraph/sdk';
import type { SignatureMap } from '../src/types/api.types.js';

/** Input for signing multiple transactions */
interface TransactionInput {
  txPath: string;
  privateKeys: string[];
  transactionId: string;
}

/** Output from signing multiple transactions */
interface SignedTransactionOutput {
  transactionId: string;
  signatureMap: SignatureMap; // Single merged SignatureMap (all keys combined)
}

/** Output file format for k6 */
interface K6SignaturesOutput {
  generatedAt: string;
  count: number;
  transactions: SignedTransactionOutput[];
  /** Signatures keyed by transaction ID - single SignatureMap per tx (not array!) */
  signaturesByTxId: Record<string, SignatureMap>;
}

/**
 * Convert SDK signature map to backend format
 * Structure: nodeAccountId -> transactionId -> publicKey -> signature (hex with 0x prefix)
 */
function signatureMapToBackendFormat(
  signatureMap: Map<string, Map<string, Map<string, Uint8Array>>>,
): SignatureMap {
  const result: SignatureMap = {};

  for (const [nodeAccountId, txMap] of signatureMap.entries()) {
    result[nodeAccountId] = {};

    for (const [transactionId, pkMap] of txMap.entries()) {
      result[nodeAccountId][transactionId] = {};

      for (const [publicKey, signature] of pkMap.entries()) {
        // Use hex encoding with 0x prefix (as expected by backend)
        result[nodeAccountId][transactionId][publicKey] =
          '0x' + Buffer.from(signature).toString('hex');
      }
    }
  }

  return result;
}

/**
 * Sign a transaction with a single private key
 * @param txBytes - Transaction bytes
 * @param privateKeyString - ED25519 private key string
 * @returns Signature in backend format
 */
export function signTransaction(txBytes: Buffer, privateKeyString: string): SignatureMap {
  const tx = Transaction.fromBytes(txBytes);
  const pk = PrivateKey.fromStringED25519(privateKeyString);
  const signatureMap = pk.signTransaction(tx);
  return signatureMapToBackendFormat(
    signatureMap as unknown as Map<string, Map<string, Map<string, Uint8Array>>>,
  );
}

/**
 * Merge a SignatureMap into an existing one
 * Combines signatures from multiple keys into a single nested structure
 */
function mergeSignatureMaps(target: SignatureMap, source: SignatureMap): void {
  for (const [nodeId, txMap] of Object.entries(source)) {
    if (!target[nodeId]) target[nodeId] = {};
    for (const [txId, pkMap] of Object.entries(txMap)) {
      if (!target[nodeId][txId]) target[nodeId][txId] = {};
      Object.assign(target[nodeId][txId], pkMap);
    }
  }
}

/**
 * Sign a transaction with multiple private keys
 * @param txBytes - Transaction bytes
 * @param privateKeys - Array of ED25519 private key strings
 * @returns Single merged SignatureMap with all keys combined
 */
export function signTransactionWithMultipleKeys(
  txBytes: Buffer,
  privateKeys: string[],
): SignatureMap {
  const tx = Transaction.fromBytes(txBytes);
  const merged: SignatureMap = {};

  for (const keyString of privateKeys) {
    const pk = PrivateKey.fromStringED25519(keyString);
    const signatureMap = pk.signTransaction(tx);
    const formatted = signatureMapToBackendFormat(
      signatureMap as unknown as Map<string, Map<string, Map<string, Uint8Array>>>,
    );
    mergeSignatureMaps(merged, formatted);
  }

  return merged;
}

/**
 * Sign multiple transactions from files
 * @param transactions - Array of { txPath, privateKeys, transactionId }
 * @returns Array of { transactionId, signatureMap }
 */
export function signMultipleTransactions(transactions: TransactionInput[]): SignedTransactionOutput[] {
  return transactions.map(({ txPath, privateKeys, transactionId }) => {
    const txBytes = fs.readFileSync(txPath);
    const signatureMap = signTransactionWithMultipleKeys(txBytes, privateKeys);
    return {
      transactionId,
      signatureMap,
    };
  });
}

/**
 * Generate test signatures for k6 performance testing
 * Creates a JSON file that k6 can load
 * @param outputPath - Path to write signatures JSON
 * @param signedTransactions - Output from signMultipleTransactions
 */
export function writeSignaturesForK6(outputPath: string, signedTransactions: SignedTransactionOutput[]): void {
  // Build signaturesByTxId keyed by transaction ID - single SignatureMap per tx
  const signaturesByTxId: Record<string, SignatureMap> = {};
  for (const tx of signedTransactions) {
    signaturesByTxId[tx.transactionId] = tx.signatureMap;
  }

  const output: K6SignaturesOutput = {
    generatedAt: new Date().toISOString(),
    count: signedTransactions.length,
    transactions: signedTransactions,
    signaturesByTxId,
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${signedTransactions.length} transaction signatures to ${outputPath}`);
}

// CLI interface
const isMainModule = process.argv[1]?.includes('sign-transactions');

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log(
      'Usage: npx tsx sign-transactions.ts <transaction.tx> <output.json> <privateKey1> [privateKey2] ...',
    );
    console.log('');
    console.log('Example:');
    console.log('  npx tsx sign-transactions.ts ./data/test.tx ./data/signatures.json 302e...key1 302e...key2');
    process.exit(1);
  }

  const [txPath, outputPath, ...privateKeys] = args;

  try {
    const txBytes = fs.readFileSync(txPath);
    const signatureMap = signTransactionWithMultipleKeys(txBytes, privateKeys);

    // For CLI usage, we don't have transaction IDs, so we use filename as key
    const txId = path.basename(txPath, path.extname(txPath));
    const signaturesByTxId: Record<string, SignatureMap> = {
      [txId]: signatureMap,
    };

    const output = {
      generatedAt: new Date().toISOString(),
      transactionFile: path.basename(txPath),
      keyCount: privateKeys.length,
      signatureMap,
      signaturesByTxId,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Successfully signed transaction with ${privateKeys.length} key(s)`);
    console.log(`Output written to: ${outputPath}`);
  } catch (error) {
    const err = error as Error;
    console.error('Error:', err.message);
    process.exit(1);
  }
}
