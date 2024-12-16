import path from 'path';

import { app, shell } from 'electron';
import { HederaFile, Prisma } from '@prisma/client';

import { getPrismaClient } from '@main/db/prisma';
import { deleteDirectory, getNumberArrayFromString, saveContentToPath } from '@main/utils';
import { safeAwait } from '@main/utils/safeAwait';

export const getFiles = async (findArgs: Prisma.HederaFileFindManyArgs) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.hederaFile.findMany(findArgs);
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addFile = async (file: Prisma.HederaFileUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  const alreadyAddedCount = await prisma.hederaFile.count({
    where: {
      user_id: file.user_id,
      OR: [
        { file_id: file.file_id, network: file.network },
        file.nickname && file.nickname.trim().length > 0
          ? { nickname: file.nickname, network: file.network }
          : {},
      ],
    },
  });

  if (alreadyAddedCount > 0) {
    throw new Error('File ID or Nickname already exists!');
  }

  delete file.id;

  await prisma.hederaFile.create({
    data: {
      ...file,
      nickname: file.nickname && file.nickname.trim().length > 0 ? file.nickname : null,
    },
  });

  return await getFiles({
    where: {
      user_id: file.user_id,
    },
  });
};

export const removeFiles = async (user_id: string, file_ids: string[]) => {
  const prisma = getPrismaClient();

  await prisma.hederaFile.deleteMany({
    where: {
      user_id,
      file_id: {
        in: file_ids,
      },
    },
  });
};

export const updateFile = async (
  file_id: string,
  user_id: string,
  file: Prisma.HederaFileUncheckedUpdateInput,
) => {
  const prisma = getPrismaClient();

  await prisma.hederaFile.updateMany({
    where: {
      file_id,
      user_id,
    },
    data: {
      ...file,
      nickname:
        file.nickname && typeof file.nickname === 'string' && file.nickname.trim().length > 0
          ? file.nickname
          : null,
      user_id,
    },
  });

  return await getFiles({
    where: {
      user_id,
    },
  });
};

export const showStoredFileInTemp = async (userId: string, fileId: string) => {
  const prisma = getPrismaClient();

  let file: HederaFile | null = null;

  try {
    file = await prisma.hederaFile.findFirst({
      where: {
        user_id: userId,
        file_id: fileId,
      },
    });
  } catch (error) {
    console.log(error);
  }

  if (file === null) {
    throw new Error('File not found');
  }

  if (file.contentBytes === null) {
    throw new Error('File content is unknown');
  }

  const content = Buffer.from(getNumberArrayFromString(file.contentBytes));

  await showContentInTemp(content, fileId);
};

export const showContentInTemp = async (content: Buffer, fileId: string) => {
  const filePath = path.join(app.getPath('temp'), 'electronHederaFiles', `${fileId}.txt`);

  try {
    const saved = await saveContentToPath(filePath, content);

    if (saved) {
      shell.showItemInFolder(filePath);
      shell.openPath(filePath);
    }
  } catch (error) {
    console.log(error);
    throw new Error('Failed to open file content');
  }
};

export const deleteTempFolder = async (folder: string) => {
  const directoryPath = path.join(app.getPath('temp'), folder);
  await safeAwait(deleteDirectory(directoryPath));
};

export const deleteAllTempFolders = async () => {
  const tempFolders = ['electronHederaFiles', 'encryptedKeys'];

  for (const folder of tempFolders) {
    await deleteTempFolder(folder);
  }
};
