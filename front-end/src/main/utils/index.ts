import path from 'node:path';
import fs from 'fs/promises';

export const getNumberArrayFromString = (str: string) => {
  return str.split(',').map(n => Number(n));
};

export const JSONtoUInt8Array = json => {
  const str = JSON.stringify(json, null, 0);
  const ret = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    ret[i] = str.charCodeAt(i);
  }
  return ret;
};

export const saveContentToPath = async (filePath: string, content: Buffer) => {
  try {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(filePath, content);

    return true;
  } catch {
    return false;
  }
};

export const deleteDirectory = async (directoryPath: string) => {
  try {
    const pathStat = await fs.stat(directoryPath);

    if (pathStat.isDirectory()) {
      await fs.rmdir(directoryPath, { recursive: true });
    }

    return true;
  } catch {
    return false;
  }
};
