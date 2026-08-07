import * as crypto from 'node:crypto';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as bip39 from 'bip39';
import { proto } from '@hiero-ledger/proto';
import { Key, KeyList, PublicKey } from '@hiero-ledger/sdk';

// Generates an ECDSA key pair
export function generateECDSAKeyPair(curve = 'secp256k1') {
  const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: curve,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  return privateKey.toString('hex');
}

// Generates an Ed25519 key pair
export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'der',
    },
  });

  return {
    publicKey: publicKey.toString('hex'),
    privateKey: privateKey.toString('hex')
  };
}

/**
 * Generates a fresh encrypted PKCS#8 PEM fixture on disk and returns its path
 * together with a cleanup function.  Use this in tests instead of committing a
 * static PEM file, so secret-scanning / compliance tooling never sees real (even
 * encrypted) private-key material in the repo.
 *
 * @param password - Passphrase to encrypt the private key with.
 * @returns `{ pemPath, cleanup }` — `pemPath` is the absolute path to the
 *   temporary `.pem` file; call `cleanup()` in `afterEach`/`finally` to remove it.
 */
export async function generateEncryptedPemFixture(
  password: string,
): Promise<{ pemPath: string; cleanup: () => Promise<void> }> {
  const { privateKey: pem } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: password,
    },
  });

  const pemPath = path.join(os.tmpdir(), `test-key-${crypto.randomUUID()}.pem`);
  await fsp.writeFile(pemPath, pem, 'utf-8');

  return {
    pemPath,
    cleanup: () => fsp.unlink(pemPath).catch(() => {}),
  };
}

export const decodeProtobuffKey = (protobuffEncodedKey: string) => {
  const buffer = Buffer.from(protobuffEncodedKey, 'hex');
  const protoKey = proto.Key.decode(buffer);
  // @ts-ignore
  return Key._fromProtobufKey(protoKey);
};

export const flattenKeyList = (keyList: Key) => {
  if (keyList instanceof PublicKey) {
    return [keyList];
  }

  if (!(keyList instanceof KeyList)) {
    throw new Error('Provided key is not a KeyList');
  }

  const keys: PublicKey[] = [];
  if (Array.isArray(keyList._keys)) {
    keyList._keys.forEach(key => {
      if (key instanceof PublicKey) {
        keys.push(key);
      } else if (key instanceof KeyList) {
        keys.push(...flattenKeyList(key));
      }
    });
  } else {
    console.error("KeyList does not have a 'keys' property or it's not an array", keyList);
    throw new Error('KeyList is malformed');
  }

  return keys;
};

export const decodeAndFlattenKeys = (protobuffEncodedKey: string) => {
  try {
    const decodedKey = decodeProtobuffKey(protobuffEncodedKey);

    const flatKeys = flattenKeyList(decodedKey);

    return flatKeys.map(key => key.toString());
  } catch (error) {
    console.error('Error decoding and flattening keys:', error);
    return [];
  }
};

// Generates a 24-word seed mnemonic phrase
export function generateMnemonic() {
  return bip39.generateMnemonic(256);
}
