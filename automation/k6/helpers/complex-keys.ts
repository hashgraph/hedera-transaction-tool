/**
 * Complex Threshold Key Generator
 *
 * Generates Hedera-style nested threshold keys for performance testing.
 * The key structure mimics account 0.0.2's complex admin key pattern.
 *
 * This runs in Node.js (not k6) because k6 cannot use @hashgraph/sdk.
 *
 * Usage:
 *   import { generateHederaStyleComplexKey } from './complex-keys';
 *   const { adminKey, allPrivateKeys } = generateHederaStyleComplexKey();
 */

import { KeyList, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

/** Result from generating a complex threshold key */
export interface ComplexKeyResult {
  /** The threshold key structure (KeyList with nested KeyLists) */
  adminKey: KeyList;
  /** All private keys generated (for signing) */
  allPrivateKeys: PrivateKey[];
  /** Lookup map: publicKey.toStringRaw() -> PrivateKey */
  publicKeyToPrivateKey: Map<string, PrivateKey>;
  /** Metadata about the key structure */
  metadata: ComplexKeyMetadata;
}

/** Metadata about the generated key structure */
export interface ComplexKeyMetadata {
  /** Parent threshold (e.g., 17 for "17 of 29") */
  parentThreshold: number;
  /** Number of child KeyLists */
  childCount: number;
  /** Total number of ED25519 keys */
  totalKeys: number;
  /** Child configurations */
  childConfigs: Array<{ threshold: number; numKeys: number }>;
}

/** Configuration for each child threshold key */
export interface ChildKeyConfig {
  /** Required signatures (e.g., 1 for "1 of 2") */
  threshold: number;
  /** Number of keys in this child KeyList */
  numKeys: number;
}

/** Serializable format for JSON storage */
export interface ComplexKeyJson {
  accountId: string;
  metadata: ComplexKeyMetadata;
  /** Private keys as hex strings */
  privateKeys: string[];
  /** Public keys as raw hex strings */
  publicKeys: string[];
  /** Admin key as protobuf hex (for verification) */
  adminKeyProtobuf: string;
  generatedAt: string;
}

/**
 * Generate a complex nested threshold key structure
 *
 * @param parentThreshold - Required signatures from children (e.g., 17 for "17 of 29")
 * @param childConfig - Array of { threshold, numKeys } for each child KeyList
 * @returns ComplexKeyResult with adminKey, privateKeys, and metadata
 *
 * @example
 * // Create a 2-of-3 with nested 1-of-2 children
 * const result = generateComplexThresholdKey(2, [
 *   { threshold: 1, numKeys: 2 },
 *   { threshold: 1, numKeys: 2 },
 *   { threshold: 1, numKeys: 2 },
 * ]);
 */
export function generateComplexThresholdKey(
  parentThreshold: number,
  childConfig: ChildKeyConfig[],
): ComplexKeyResult {
  const allPrivateKeys: PrivateKey[] = [];
  const publicKeyToPrivateKey = new Map<string, PrivateKey>();
  const children: KeyList[] = [];

  for (const config of childConfig) {
    const keys: PublicKey[] = [];

    for (let i = 0; i < config.numKeys; i++) {
      const privateKey = PrivateKey.generateED25519();
      allPrivateKeys.push(privateKey);
      publicKeyToPrivateKey.set(privateKey.publicKey.toStringRaw(), privateKey);
      keys.push(privateKey.publicKey);
    }

    const childList = new KeyList(keys);
    childList.setThreshold(config.threshold);
    children.push(childList);
  }

  const adminKey = new KeyList(children);
  adminKey.setThreshold(parentThreshold);

  const metadata: ComplexKeyMetadata = {
    parentThreshold,
    childCount: childConfig.length,
    totalKeys: allPrivateKeys.length,
    childConfigs: childConfig,
  };

  return { adminKey, allPrivateKeys, publicKeyToPrivateKey, metadata };
}

/**
 * Generate a key structure matching Hedera's 0.0.2 example
 *
 * Structure: THRESHOLD (17 of 29)
 * - Each child is THRESHOLD (1 of 2) or (1 of 3), alternating
 * - Total: 29 nested threshold keys, ~73 ED25519 keys
 *
 * @returns ComplexKeyResult with Hedera-style complex key
 */
export function generateHederaStyleComplexKey(): ComplexKeyResult {
  // Hedera's pattern: alternating 1-of-2 and 1-of-3 nested thresholds
  const childConfig: ChildKeyConfig[] = Array.from({ length: 29 }, (_, i) => ({
    threshold: 1,
    numKeys: i % 2 === 0 ? 2 : 3,
  }));

  return generateComplexThresholdKey(17, childConfig);
}

/**
 * Generate a simpler complex key for faster testing
 *
 * Structure: THRESHOLD (2 of 3)
 * - Each child is THRESHOLD (1 of 2)
 * - Total: 3 nested threshold keys, 6 ED25519 keys
 *
 * @returns ComplexKeyResult with simpler complex key
 */
export function generateSimpleComplexKey(): ComplexKeyResult {
  const childConfig: ChildKeyConfig[] = [
    { threshold: 1, numKeys: 2 },
    { threshold: 1, numKeys: 2 },
    { threshold: 1, numKeys: 2 },
  ];

  return generateComplexThresholdKey(2, childConfig);
}

/**
 * Serialize a ComplexKeyResult to JSON-safe format
 *
 * @param result - ComplexKeyResult from key generation
 * @param accountId - The account ID this key is assigned to
 * @returns JSON-serializable object
 */
export function serializeComplexKey(result: ComplexKeyResult, accountId: string): ComplexKeyJson {
  const protoKey = result.adminKey._toProtobufKey();
  const keyBytes = proto.Key.encode(protoKey).finish();

  return {
    accountId,
    metadata: result.metadata,
    privateKeys: result.allPrivateKeys.map((k) => k.toStringRaw()),
    publicKeys: result.allPrivateKeys.map((k) => k.publicKey.toStringRaw()),
    adminKeyProtobuf: Buffer.from(keyBytes).toString('hex'),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Deserialize a ComplexKeyJson back to usable format
 *
 * @param json - Previously serialized ComplexKeyJson
 * @returns Object with privateKeys array and publicKeyToPrivateKey map
 */
export function deserializeComplexKey(json: ComplexKeyJson): {
  privateKeys: PrivateKey[];
  publicKeyToPrivateKey: Map<string, PrivateKey>;
} {
  const privateKeys = json.privateKeys.map((k) => PrivateKey.fromStringED25519(k));
  const publicKeyToPrivateKey = new Map<string, PrivateKey>();

  for (const pk of privateKeys) {
    publicKeyToPrivateKey.set(pk.publicKey.toStringRaw(), pk);
  }

  return { privateKeys, publicKeyToPrivateKey };
}

