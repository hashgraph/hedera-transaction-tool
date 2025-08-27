import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

import * as unzipper from 'unzipper';
import { app } from 'electron';

/* Abort controller for public key search */
let currentController: AbortController | null = null;

export const searchFiles = async (
  filePaths: string[],
  extensions: string[],
  processor: (filePath: string) => Promise<any[]>,
) => {// Abort any previous search
  if (currentController) currentController.abort();

  currentController = new AbortController();
  const abortSignal = currentController.signal;

  const searchDir = path.join(app.getPath('temp'), `search_${Date.now()}`);
  const unzipDirs: string[] = [];

  await fsp.mkdir(searchDir, { recursive: true });

  const cleanup = async () => {
    const dirs = [searchDir, ...unzipDirs];
    await Promise.allSettled(dirs.map(dir => fsp.rm(dir, { recursive: true })));
  };

  abortSignal.addEventListener('abort', cleanup);

  async function recursiveSearch(filePath: string): Promise<any[]> {
    if (abortSignal && abortSignal.aborted) return [];
    try {
      const stat = await fsp.stat(filePath);
      const ext = path.extname(filePath);

      if (stat.isDirectory()) {
        const files = await fsp.readdir(filePath);
        const results: any[] = [];
        for (const file of files) {
          results.push(...await recursiveSearch(path.join(filePath, file)));
        }
        return results;
      } else if (stat.isFile() && ext === '.zip') {
        const dist = path.join(app.getPath('temp'), `unzipped_${Date.now()}`);
        unzipDirs.push(dist);
        await unzipFile(filePath, dist, extensions);
        return await recursiveSearch(dist);
      } else if (stat.isFile() && extensions.includes(ext)) {
        // Get a unique name and copy it into the searchDir to be processed
        const fileDist = await getUniquePath(searchDir, path.basename(filePath));
        await copyFile(filePath, fileDist, abortSignal);
        return await processor(filePath);
      }
    } catch (error) {
      console.log(`Error processing ${filePath}:`, error);
    }

    return [];
  }

  async function unzipFile(
    zipPath: string,
    dist: string,
    extensions: string[],
  ) {
    const macosx = '__MACOSX';
    await fsp.mkdir(dist, { recursive: true });
    const directory = await unzipper.Open.file(zipPath);
    const files = directory.files
      .filter(f => !f.path.startsWith(macosx))
      .filter(f => extensions.length > 0 ? extensions.some(ext => f.path.endsWith(ext)) : true);

    for (const file of files) {
      if (abortSignal && abortSignal.aborted) return;
      const fileName = path.basename(file.path);
      const fileDist = path.join(dist, fileName);
      await extractUnzipperFile(file, fileDist);
    }
  }

  function extractUnzipperFile(file: unzipper.File, dist: string) {
    return new Promise((resolve, reject) => {
      const stream = file.stream();
      stream
        .on('data', () => {
          if (abortSignal && abortSignal.aborted) {
            stream.destroy();
            reject('File extraction aborted');
          }
        })
        .pipe(fs.createWriteStream(dist))
        .on('close', () => resolve(dist))
        .on('error', reject);
    });
  }

  try {
    const results: any[] = [];
    for (const filePath of filePaths) {
      results.push(...await recursiveSearch(filePath));
    }

    if (abortSignal && abortSignal.aborted) {
      return [];
    }

    return results;
  } catch (error) {
    await cleanup();
    throw error;
  } finally {
    abortSignal.removeEventListener('abort', cleanup);
  }
}

export const abortFileSearch = () => {
  if (currentController) currentController.abort();
}

/* Copy the file to directory with stream */
export const copyFile = (filePath: string, fileDist: string, signal?: AbortSignal) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);

    readStream.on('data', () => {
      if (signal && signal.aborted) {
        readStream.destroy();
        reject('File copying aborted');
      }
    });
    const writeStream = fs.createWriteStream(fileDist);

    readStream.pipe(writeStream);

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => resolve(fileDist));
  });
};

/* Get unique path for file */
export const getUniquePath = async (dist: string, fileName: string) => {
  let fileDist = path.join(dist, fileName);
  let count = 1;

  while (true) {
    try {
      await fsp.access(fileDist, fs.constants.F_OK);
      // File exists, generate a new name
      const copyName = `copy_${count}_${fileName}`;
      fileDist = path.join(dist, copyName);
      count++;
    } catch {
      // File does not exist
      break;
    }
  }

  return fileDist;
};
