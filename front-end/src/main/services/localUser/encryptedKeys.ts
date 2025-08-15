import * as fsp from 'fs/promises';
import * as path from 'path';
import EventEmitter from 'events';

import { app } from 'electron';
import * as forge from 'node-forge';

import { ENCRYPTED_KEY_ALREADY_IMPORTED } from '@shared/constants';

import { copyFile, getFilePaths, getUniquePath, unzip } from '@main/utils/files';

let fileStreamEventEmitter: EventEmitter | null = null;
export const searchEncryptedKeysAbort = 'file:searchEncryptedKeys:abort';

export function getFileStreamEventEmitter() {
  if (!fileStreamEventEmitter) {
    fileStreamEventEmitter = new EventEmitter();
    fileStreamEventEmitter.setMaxListeners(0);
  }
  return fileStreamEventEmitter;
}

/* The directory name in the temp folder that stores encrypted files per search */
export const encryptedKeysDirName = 'encryptedKeys';

/* Abortable State */
export type AbortableState = { aborted: boolean };

/* Class that listens to an abort event and sets the aborted property to true */
export class Abortable {
  state: AbortableState;

  constructor(abortEvent: string) {
    this.state = { aborted: false };

    getFileStreamEventEmitter().once(abortEvent, () => {
      this.abort();
    });
  }

  abort() {
    this.state = { aborted: true };
  }
}

/* Class that searches for encrypted keys in files with provided extensions */
export class EncryptedKeysSearcher {
  private _abortable: Abortable;

  extensions: string[];
  searchDir: string;
  unzipDirs: string[];

  constructor(abortable: Abortable, extensions: string[]) {
    this._abortable = abortable;
    this.extensions = extensions;
    this.searchDir = '';
    this.unzipDirs = [];
  }

  /* Searches encrypted files in the given paths and returns paths for all found files */
  async search(filePaths: string[]) {
    await this._createSearchDir();

    for (const filePath of filePaths) {
      if (this._abortable.state.aborted) break;
      await this._searchFromPath(filePath);
    }

    if (this._abortable.state.aborted) {
      await this.deleteSearchDirs();
      return [];
    }

    return await getFilePaths(this.searchDir, this.extensions);
  }

  /* Deletes the search directory */
  async deleteSearchDirs() {
    const dirs = [this.searchDir, ...this.unzipDirs];
    const results = await Promise.allSettled(dirs.map(dir => fsp.rm(dir, { recursive: true })));

    for (const result of results) {
      if (result.status === 'rejected') {
        console.log(`Delete search dirs error:`, result.reason);
      }
    }
  }

  /* Searches encrypted files in the given path */
  private async _searchFromPath(filePath: string) {
    const pathStat = await fsp.stat(filePath);
    const extention = path.extname(filePath);

    const isDirectory = pathStat.isDirectory();
    const isFile = pathStat.isFile();
    const isZip = isFile && extention === '.zip';
    const isEncryptedFile = isFile && this.extensions.includes(extention);

    try {
      if (isDirectory) {
        await this._searchFromDir(filePath);
      } else if (isZip) {
        await this._searchFromZip(filePath);
      } else if (isEncryptedFile) {
        const fileDist = await getUniquePath(this.searchDir, path.basename(filePath));
        await copyFile(filePath, fileDist, this._abortable.state);
      }
    } catch (error) {
      console.log(error);
    }
  }

  /* Searches encrypted files in the given paths */
  private async _searchFromDir(dir: string) {
    const dirFileName = await fsp.readdir(dir);

    for (const fileName of dirFileName) {
      if (this._abortable.state.aborted) return;
      try {
        await this._searchFromPath(path.join(dir, fileName));
      } catch (error) {
        console.log(error);
      }
    }
  }

  /* Searches encrypted files in the ZIP */
  private async _searchFromZip(zipPath: string) {
    const dist = path.join(app.getPath('temp'), encryptedKeysDirName, `unzipped_${Date.now()}`);
    this.unzipDirs.push(dist);

    await unzip(zipPath, dist, this.extensions, this._abortable.state);
    await this._searchFromDir(dist);
  }

  /* Creates a directory in the temp folder to store the encrypted PEM files */
  private async _createSearchDir() {
    const now = Date.now();
    const searchFolderName = `encryptedKeys_${now}`;
    const tempDir = app.getPath('temp');

    this.searchDir = path.join(tempDir, encryptedKeysDirName, searchFolderName);
    await fsp.mkdir(this.searchDir, { recursive: true });
  }
}

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
