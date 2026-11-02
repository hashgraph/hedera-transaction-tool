import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as forge from 'node-forge';
import * as argon2 from 'argon2';
import { Mnemonic, PrivateKey } from '@hiero-ledger/sdk';

import { CommonNetwork } from '@shared/enums';
import {
  DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
  SELECTED_NETWORK,
  UPDATE_LOCATION,
} from '@shared/constants';

import {
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  locateDataMigrationFiles,
  migrateUserData,
} from '@main/services/localUser/dataMigration';
import {
  decryptPrivateKeyFromPath,
  searchEncryptedKeys,
} from '@main/services/localUser/encryptedKeys';
import { addAccount } from '@main/services/localUser/accounts';
import { addClaim } from '@main/services/localUser/claim';
import { addPublicKey } from '@main/services/localUser/publicKeyMapping';

/**
 * These tests run the main-process migration code against a TTv1 data directory that is
 * generated on the fly (nothing is checked in). The layout, file formats and encryption
 * mirror a real TTv1 export:
 *
 *   TransactionTools/
 *     Files/user.properties
 *     Files/.System/recovery.aes       AES-256-GCM, key = argon2id(password, salt from `hash`)
 *     Accounts/<id>-<NETWORK>.json     account info (+ ignored .info protobuf sibling)
 *     Keys/<name>.pem                  PKCS#8 encrypted private key with recovery phrase headers
 *     Keys/<name>.pub                  public key hex
 */

const documentsDir = vi.hoisted(() => ({ value: '' }));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => documentsDir.value) },
}));
vi.mock('@main/services/localUser/accounts');
vi.mock('@main/services/localUser/claim');
vi.mock('@main/services/localUser/publicKeyMapping');

const WORDS =
  'inmate modify chronic paddle inch ginger impose ridge flock joke local traffic arrange sorry report object spend thing spoon cave able million round stay'.split(
    ' ',
  );
const PASSWORD = 'test_password';
const USER_ID = 'user-1';
const HEADER = Buffer.from('AES|256|CBC|PKCS5Padding|', 'utf8');
const RECOVERY_HASH_CODE = 1082629454;

let root: string;
let hashToken: string;
let orphanPublicKey: string;
let derivedKeys: PrivateKey[];

const write = (relative: string, content: string | Buffer) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const encryptRecoveryFile = async (words: string[], password: string, token: string) => {
  const salt = Buffer.from(token, 'base64').subarray(0, 16);
  const key = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 262144,
    timeCost: 3,
    parallelism: 1,
    salt,
    raw: true,
  });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(words.join(' '), 'utf8'), cipher.final()]);
  return Buffer.concat([HEADER, iv, encrypted, cipher.getAuthTag()]);
};

const encryptedPem = (key: PrivateKey, index: number, password: string) => {
  const pkcs8 = forge.asn1.fromDer(forge.util.hexToBytes(key.toStringDer()));
  const encrypted = forge.pki.encryptPrivateKeyInfo(pkcs8, password, {
    algorithm: 'aes256',
    count: 65536,
    prfAlgorithm: 'sha512',
  });
  return [
    'Application: Transaction Tool UI',
    'Version: Version: 0.14.8',
    `Index: ${index}`,
    `Recovery Phrase Hash: ${RECOVERY_HASH_CODE}`,
    forge.pki.encryptedPrivateKeyToPem(encrypted),
  ].join('\n');
};

const accountFile = (accountNum: number) =>
  JSON.stringify({
    accountID: { realmNum: 0, shardNum: 0, accountNum },
    contractAccountID: accountNum.toString(16).padStart(40, '0'),
    key: { thresholdKey: { threshold: 1, keyList: [] } },
    balance: 36900000000,
  });

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ttv1-export-'));
  documentsDir.value = root;
  // The app resolves <documents>/TransactionTools
  root = path.join(root, 'TransactionTools');

  const mnemonic = await Mnemonic.fromWords(WORDS);
  derivedKeys = await Promise.all([0, 1].map(i => mnemonic.toStandardEd25519PrivateKey('', i)));
  orphanPublicKey = PrivateKey.generateED25519().publicKey.toStringRaw();

  hashToken = crypto.randomBytes(48).toString('base64');

  write(
    'Files/user.properties',
    [
      '#',
      '#Tue Oct 27 23:26:50 PDT 2026',
      'mnemonicChecksum=lrcfgFmejFy9gVU494nVSw\\=\\=',
      'salt=true',
      'legacy=false',
      'credentials={"/Users/someone/Documents/2.4.1test/testset"\\:"someone@example.com"}',
      'currentNetwork=MAINNET',
      'setupPhase=9',
      'version=Version\\: 0.14.8',
      `hash=${hashToken}`,
      'accountInfoMap={}',
    ].join('\n'),
  );
  write('Files/.System/recovery.aes', await encryptRecoveryFile(WORDS, PASSWORD, hashToken));
  write('Accounts/0.0.50-TESTNET.json', accountFile(50));
  write('Accounts/0.0.50-TESTNET.info', Buffer.from([0x32, 0x28, 0xff, 0x00]));
  write('Accounts/0.0.55-TESTNET.json', accountFile(55));
  write('Accounts/0.0.55-TESTNET.info', Buffer.from([0x37, 0x28, 0xff, 0x00]));
  write('Keys/testkey1.pem', encryptedPem(derivedKeys[0], 0, PASSWORD));
  write('Keys/testkey1.pub', derivedKeys[0].publicKey.toStringRaw());
  write('Keys/testkey2.pem', encryptedPem(derivedKeys[1], 1, PASSWORD));
  write('Keys/testkey2.pub', derivedKeys[1].publicKey.toStringRaw());
  write('Keys/watchonly.pub', orphanPublicKey);
});

afterAll(() => {
  fs.rmSync(path.dirname(root), { recursive: true, force: true });
});

beforeEach(() => {
  vi.mocked(addAccount).mockReset();
  vi.mocked(addClaim).mockReset();
  vi.mocked(addPublicKey).mockReset();
});

describe('TTv1 export migration', () => {
  test('locates the export in the documents folder', () => {
    expect(locateDataMigrationFiles()).toBe(true);
  });

  describe('recovery phrase', () => {
    test('is decrypted with the export password', async () => {
      expect(await decryptMigrationMnemonic(PASSWORD)).toEqual(WORDS);
    });

    test('is not revealed with the wrong password', async () => {
      expect(await decryptMigrationMnemonic('wrong_password')).toBeNull();
    });
  });

  describe('encrypted private keys', () => {
    test('are found in the export keys folder', async () => {
      const found = await searchEncryptedKeys([getDataMigrationKeysPath()]);
      expect(found.map(p => path.basename(p)).sort()).toEqual(['testkey1.pem', 'testkey2.pem']);
    });

    test('decrypt with the export password to the keys derived from the recovery phrase', async () => {
      for (const [index, expected] of derivedKeys.entries()) {
        const result = await decryptPrivateKeyFromPath(
          path.join(getDataMigrationKeysPath(), `testkey${index + 1}.pem`),
          PASSWORD,
          null,
          null,
        );

        expect(result.index).toBe(index);
        expect(result.recoveryPhraseHashCode).toBe(RECOVERY_HASH_CODE);
        expect(PrivateKey.fromStringDer(result.privateKey).publicKey.toStringRaw()).toBe(
          expected.publicKey.toStringRaw(),
        );
      }
    });

    test('reject a wrong password', async () => {
      await expect(
        decryptPrivateKeyFromPath(
          path.join(getDataMigrationKeysPath(), 'testkey1.pem'),
          'wrong_password',
          null,
          null,
        ),
      ).rejects.toThrow('Incorrect encryption password');
    });
  });

  describe('migrateUserData', () => {
    test('imports accounts, settings and public keys', async () => {
      const result = await migrateUserData(USER_ID);

      expect(result).toEqual({
        accountsImported: 2,
        publicKeysImported: 1,
        defaultMaxTransactionFee: null,
        currentNetwork: CommonNetwork.MAINNET,
      });
    });

    test('takes the network of each account from its file name, not the default network', async () => {
      await migrateUserData(USER_ID);

      expect(addAccount).toHaveBeenCalledTimes(2);
      expect(addAccount).toHaveBeenCalledWith(
        USER_ID,
        '0.0.50',
        CommonNetwork.TESTNET,
        '0.0.50-TESTNET',
      );
      expect(addAccount).toHaveBeenCalledWith(
        USER_ID,
        '0.0.55',
        CommonNetwork.TESTNET,
        '0.0.55-TESTNET',
      );
    });

    test('imports only public keys that have no matching private key file', async () => {
      await migrateUserData(USER_ID);

      expect(addPublicKey).toHaveBeenCalledTimes(1);
      expect(addPublicKey).toHaveBeenCalledWith(orphanPublicKey, 'watchonly');
    });

    test('stores the selected network and update location claims, but no fee claim when absent', async () => {
      await migrateUserData(USER_ID);

      expect(addClaim).toHaveBeenCalledWith(USER_ID, SELECTED_NETWORK, CommonNetwork.MAINNET);
      expect(addClaim).toHaveBeenCalledWith(
        USER_ID,
        UPDATE_LOCATION,
        '/Users/someone/Documents/2.4.1test/testset/InputFiles',
      );
      expect(addClaim).not.toHaveBeenCalledWith(
        USER_ID,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        expect.anything(),
      );
    });
  });
});
