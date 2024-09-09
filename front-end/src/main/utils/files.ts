import * as path from 'path';
import * as fsp from 'fs/promises';

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
