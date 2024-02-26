import path from 'node:path';
import fs from 'fs/promises';

export const getNumberArrayFromString = (str: string) => {
  return str.split(',').map(n => Number(n));
};

export const saveContentToPath = async (filePath: string, content: Buffer) => {
  try {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(filePath, content);

    return true;
  } catch (error) {
    console.log(error);

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
  } catch (error) {
    console.log(error);
    return false;
  }
};
