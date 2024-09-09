import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

import { app } from 'electron';

import * as unzipper from 'unzipper';
// import * as forge from 'node-forge';

/* The directory name in the temp folder that stores encrypted files per search */
export const encryptedKeysDirName = 'encryptedKeys';

/* Get the files with encrypted private key */
export const searchEncryptedKeys = async (filePaths: string[]) => {
  const currentSearchDir = await createDirForCurrentSearch();

  for (const filePath of filePaths) {
    await storePemFromPath(filePath, currentSearchDir);
  }

  return await getFilePaths(currentSearchDir, ['.pem']);
};

export const createDirForCurrentSearch = async () => {
  const now = Date.now();
  const tempDir = app.getPath('temp');

  const searchFolderName = `encryptedKeys_${now}`;

  const currentSearchDir = path.join(tempDir, encryptedKeysDirName, searchFolderName);
  await fsp.mkdir(currentSearchDir, { recursive: true });

  return currentSearchDir;
};

export const storePemFromPath = async (filePath: string, storePath: string) => {
  const pathStat = await fsp.stat(filePath);
  const extention = path.extname(filePath);

  const isDirectory = pathStat.isDirectory();
  const isFile = pathStat.isFile();
  const isZip = isFile && extention === '.zip';
  const isPem = isFile && extention === '.pem';

  if (isDirectory) {
    await storePemsFromDir(filePath, storePath);
  } else if (isZip) {
    await storePemFromZip(filePath, storePath);
  } else if (isPem) {
    await storePem(filePath, storePath);
  }
};

export const storePemsFromDir = async (dir: string, storePath: string) => {
  try {
    const dirFileName = await fsp.readdir(dir);

    for (const fileName of dirFileName) {
      const filePath = path.join(dir, fileName);
      await storePemFromPath(filePath, storePath);
    }
  } catch (error) {
    console.log(error);
  }
};

export const storePem = async (filePath: string, storePath: string) => {
  try {
    /* Check if the file already exists */
    await fsp.access(path.join(storePath, path.basename(filePath)));
  } catch (error) {
    await fsp.copyFile(filePath, path.join(storePath, path.basename(filePath)));
  }
};

export const storePemFromZip = async (zipPath: string, storePath: string) => {
  try {
    const dist = await unzipInTemp(zipPath, ['.pem']);
    await storePemsFromDir(dist, storePath);
  } catch (error) {
    console.log(error);
  }
};

let aborted = false;

export const unzipInTemp = async (zipPath: string, extensions: string[]) => {
  const macosx = '__MACOSX';

  const now = Date.now();
  const tempDir = app.getPath('temp');
  const dist = path.join(tempDir, encryptedKeysDirName, `unzipped_${now}`);

  await fsp.mkdir(dist, { recursive: true });

  const directory = await unzipper.Open.file(zipPath);

  const pemFiles = directory.files
    .filter(f => !f.path.startsWith(macosx))
    .filter(f => (extensions.length > 0 ? extensions.some(ext => f.path.endsWith(ext)) : true));

  setTimeout(() => {
    aborted = true;
  }, 2000);
  for (const file of pemFiles) {
    try {
      // if (aborted) return dist;

      await extractFile(file, dist);
    } catch (error) {
      console.log(error);
    }
  }

  return dist;
};

function extractFile(file: unzipper.File, dist: string) {
  return new Promise((resolve, reject) => {
    let fileName = path.basename(file.path);
    let fileDist = path.join(dist, fileName);
    let count = 1;

    while (fs.existsSync(fileDist)) {
      fileName = `${count}_${path.basename(file.path)}`;
      fileDist = path.join(dist, fileName);
      count++;
    }
    console.log(fileName);

    const stream = file.stream();

    stream
      .on('data', () => {
        console.log('chunk');
        if (aborted) {
          stream.destroy();
          fs.rm(fileDist, () => {
            reject('aborted');
          });
        }
      })
      .pipe(fs.createWriteStream(fileDist))
      .on('close', () => {
        console.log('close');
      })
      .on('finish', () => {
        setTimeout(() => {
          resolve(fileDist);
        }, 100);
      })
      .on('error', e => {
        console.log('ERROR IN WRITE');

        reject(e);
      });
  });
}

export const getFilePaths = async (searchPath: string, extensions: string[]) => {
  const filePaths: string[] = [];

  const files = await fsp.readdir(searchPath);

  for (const file of files) {
    if (extensions.some(ext => file.endsWith(ext))) {
      filePaths.push(path.join(searchPath, file));
    }
  }

  return filePaths;
};
