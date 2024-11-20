import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

import * as unzipper from 'unzipper';

import { AbortableState } from '@main/services/localUser';

/* Get file paths for given extensions */
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

/* Unzip the file to directory */
export const unzip = async (
  zipPath: string,
  dist: string,
  extensions: string[],
  state?: AbortableState,
) => {
  const macosx = '__MACOSX';

  await fsp.mkdir(dist, { recursive: true });

  const directory = await unzipper.Open.file(zipPath);

  const pemFiles = directory.files
    .filter(f => !f.path.startsWith(macosx))
    .filter(f => (extensions.length > 0 ? extensions.some(ext => f.path.endsWith(ext)) : true));

  for (const file of pemFiles) {
    try {
      if (state && state.aborted) return dist;

      const fileName = path.basename(file.path);
      const fileDist = await getUniquePath(dist, fileName);

      await extractUnzipperFile(file, fileDist, state);
    } catch (error) {
      console.log(error);
    }
  }

  return dist;
};

/* Extract the file with stream */
export const extractUnzipperFile = (file: unzipper.File, dist: string, state?: AbortableState) => {
  return new Promise((resolve, reject) => {
    const stream = file.stream();

    stream
      .on('data', () => {
        if (state && state.aborted) {
          stream.destroy();
          reject('File extraction aborted');
        }
      })
      .pipe(fs.createWriteStream(dist))
      .on('close', () => resolve(dist))
      .on('error', reject);
  });
};

/* Copy the file to directory with stream */
export const copyFile = (filePath: string, fileDist: string, state?: AbortableState) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);

    readStream.on('data', () => {
      if (state && state.aborted) {
        readStream.destroy();
        reject('File copying aborted');
      }
    });
    const writeStream = fs.createWriteStream(fileDist);

    readStream.pipe(writeStream);

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
  });
};

/* Get unique path for file */
export const getUniquePath = async (dist: string, fileName: string) => {
  let fileDist = path.join(dist, fileName);
  let exists = true;
  let count = 1;

  while (exists) {
    try {
      await fsp.access(fileDist, fs.constants.F_OK);
    } catch {
      exists = false;
      break;
    }
    fileName = `copy_${count}_${fileName}`;
    fileDist = path.join(dist, fileName);
    count++;
  }

  return fileDist;
};
