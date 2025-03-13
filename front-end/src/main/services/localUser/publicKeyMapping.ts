import * as fsp from 'fs/promises';
import * as path from 'path';

import EventEmitter from 'events';
import { app } from 'electron';
import { unzip } from '@main/utils/files';
import { PublicKeyMapping } from '@prisma/client';
import { getPrismaClient } from '@main/db/prisma';

//Get stored public keys
export const getPublicKeys = async (): Promise<PublicKeyMapping[]> => {
  const prisma = getPrismaClient();
  const publicKeys = await prisma.publicKeyMapping.findMany();
  return publicKeys.map(mapping => {
    const { public_key, ...rest } = mapping;
    return {
      ...rest,
      publicKey: public_key,
    };
  });
};

//add new public key
export const addPublicKey = async (
  publicKey: string,
  nickname: string,
): Promise<PublicKeyMapping> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.create({
    data: {
      public_key: publicKey,
      nickname: nickname,
    },
  });
};

// get a single public key mapping
export const getPublicKey = async (publicKey: string): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.findUnique({
    where: { public_key: publicKey },
  });
};

//Edit nickname
export const updatePublicKeyNickname = async (
  id: string,
  newNickname: string,
): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.update({
    where: { id: id },
    data: { nickname: newNickname },
  });
};

//Delete stored public key mapping
export const deletePublicKey = async (id: string): Promise<PublicKeyMapping | null> => {
  const prisma = getPrismaClient();

  return prisma.publicKeyMapping.delete({
    where: { id: id },
  });
};

/* Abort event for public key search */
export const searchPublicKeysAbort = 'file:searchPublicKeys:abort';

let fileStreamEventEmitter: EventEmitter | null = null;
export function getFileStreamEventEmitterPublic() {
  if (!fileStreamEventEmitter) {
    fileStreamEventEmitter = new EventEmitter();
    fileStreamEventEmitter.setMaxListeners(0);
  }
  return fileStreamEventEmitter;
}

/* Abortable State */
export class PublicAbortable {
  state: { aborted: boolean };

  constructor(abortEvent: string) {
    this.state = { aborted: false };
    getFileStreamEventEmitterPublic().once(abortEvent, () => {
      this.abort();
    });
  }

  abort() {
    this.state = { aborted: true };
  }
}

/* Searches for `.pub` public key files */
export class PublicKeySearcher {
  private _abortable: PublicAbortable;
  extensions: string[];
  searchDir: string;
  unzipDirs: string[];

  constructor(abortable: PublicAbortable) {
    this._abortable = abortable;
    this.extensions = ['.pub'];
    this.searchDir = '';
    this.unzipDirs = [];
  }

  async search(filePaths: string[]) {
    await this._createSearchDir();
    const foundKeys: { publicKey: string; nickname: string }[] = [];

    for (const filePath of filePaths) {
      if (this._abortable.state.aborted) break;
      foundKeys.push(...((await this._searchFromPath(filePath)) || []));
    }

    if (this._abortable.state.aborted) {
      await this.deleteSearchDirs();
      return [];
    }

    return foundKeys;
  }

  async deleteSearchDirs() {
    const dirs = [this.searchDir, ...this.unzipDirs];
    const results = await Promise.allSettled(dirs.map(dir => fsp.rm(dir, { recursive: true })));

    for (const result of results) {
      if (result.status === 'rejected') {
        console.log(`Delete search dirs error:`, result.reason);
      }
    }
  }

  private async _searchFromPath(
    filePath: string,
  ): Promise<{ publicKey: string; nickname: string }[]> {
    try {
      const pathStat = await fsp.stat(filePath);
      const extension = path.extname(filePath);

      const isDirectory = pathStat.isDirectory();
      const isFile = pathStat.isFile();
      const isZip = isFile && extension === '.zip';
      const isPublicKeyFile = isFile && this.extensions.includes(extension);
      const foundKeys: { publicKey: string; nickname: string }[] = [];

      if (isDirectory) {
        foundKeys.push(...((await this._searchFromDir(filePath)) || []));
      } else if (isZip) {
        foundKeys.push(...((await this._searchFromZip(filePath)) || []));
      } else if (isPublicKeyFile) {
        const fileDist = path.join(this.searchDir, path.basename(filePath));
        await fsp.copyFile(filePath, fileDist);
        const publicKeyContent = await fsp.readFile(filePath, 'utf-8');
        const nickname = path.basename(filePath, '.pub');
        foundKeys.push({ publicKey: publicKeyContent.trim(), nickname });
      }
      return foundKeys;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  private async _searchFromDir(dir: string) {
    const dirFileNames = await fsp.readdir(dir);
    const foundKeys: { publicKey: string; nickname: string }[] = [];

    for (const fileName of dirFileNames) {
      if (this._abortable.state.aborted) return foundKeys;
      try {
        foundKeys.push(...((await this._searchFromPath(path.join(dir, fileName))) || []));
      } catch (error) {
        console.log(error);
      }
    }

    return foundKeys;
  }

  private async _searchFromZip(
    zipPath: string,
  ): Promise<{ publicKey: string; nickname: string }[]> {
    const dist = path.join(app.getPath('temp'), `unzipped_${Date.now()}`);
    this.unzipDirs.push(dist);

    try {
      await unzip(zipPath, dist, this.extensions, this._abortable.state);
      return (await this._searchFromDir(dist)) || [];
    } catch (error) {
      console.error('Error extracting zip:', zipPath, error);
      return [];
    }
  }

  private async _createSearchDir() {
    const now = Date.now();
    const searchFolderName = `publicKeys_${now}`;
    const tempDir = app.getPath('temp');

    this.searchDir = path.join(tempDir, searchFolderName);
    await fsp.mkdir(this.searchDir, { recursive: true });
  }
}
