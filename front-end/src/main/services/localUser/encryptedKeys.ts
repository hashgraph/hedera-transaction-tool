import * as fsp from 'fs/promises';

import * as forge from 'node-forge';

import { ENCRYPTED_KEY_ALREADY_IMPORTED } from '@shared/constants';

import { abortFileSearch, searchFiles } from '@main/utils/files';

export const decryptPrivateKeyFromPath = async (
  filePath: string,
  password: string,
  skipIndexes: number[] | null,
  skipHashCode: number | null,
): Promise<{
  privateKey: string;
  recoveryPhraseHashCode: number | null;
  index: number | null;
}> => {
  const fileContent = await fsp.readFile(filePath, 'utf-8');

  const info = getRecoveryPhraseInfo(fileContent);

  if (
    info &&
    skipIndexes &&
    skipIndexes.includes(info.index) &&
    skipHashCode &&
    skipHashCode === info.hashCode
  ) {
    throw new Error(ENCRYPTED_KEY_ALREADY_IMPORTED);
  }

  try {
    const privateKey = decryptPrivateKeyFromPem(fileContent, password);

    return {
      privateKey,
      recoveryPhraseHashCode: info ? info.hashCode : null,
      index: info ? info.index : null,
    };
  } catch {
    throw new Error('Incorrect encryption password');
  }
};

/* Decrypts encrypted private key from PEM */
export const decryptPrivateKeyFromPem = (pem: string, password: string): string => {
  /* Parse the PEM file to get the encrypted private key info */
  const encryptedPrivateKeyInfo = forge.pki.encryptedPrivateKeyFromPem(pem);

  /* Decrypt the private key */
  const privateKeyInfo = forge.pki.decryptPrivateKeyInfo(encryptedPrivateKeyInfo, password);

  if (!privateKeyInfo) throw new Error('Incorrect encryption password');

  /* Convert the private key to DER bytes */
  const asn1PrivateKey = forge.asn1.toDer(privateKeyInfo);

  /* Format the private key in hex */
  const hex = asn1PrivateKey.toHex();

  return hex;
};

export const getRecoveryPhraseInfo = (pem: string): { hashCode: number; index: number } | null => {
  const indexName = 'Index: ';
  const recoveryPhraseHashName = 'Recovery Phrase Hash: ';

  const pemLines = pem.split('\n');

  const recoveryPhraseLine = pemLines.find(line => line.includes(recoveryPhraseHashName));
  const indexLine = pemLines.find(line => line.includes(indexName));

  if (!recoveryPhraseLine || !indexLine) return null;

  const recoveryPhraseHashCode = recoveryPhraseLine.split(recoveryPhraseHashName)[1];
  const index = indexLine.split(indexName)[1];

  return { hashCode: Number(recoveryPhraseHashCode), index: Number(index) };
};

//TODO my tests need to test the stuff in processfile, too. I can't just mock that out

/* Searches for `.pub` public key files in the given paths */
export const searchEncryptedKeys = async (filePaths: string[]) => {
  const processFile = async (filePath: string) => {
    return filePath;
  }

  return await searchFiles(filePaths, ['.pem'], processFile);
}

export const abortEncryptedKeySearch = () => {
  abortFileSearch();
}
