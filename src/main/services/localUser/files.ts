import { getPrismaClient } from '@main/db';
import { Prisma } from '@prisma/client';

export const getFiles = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.hederaFile.findMany({
      where: {
        user_id: userId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addFile = async (file: Prisma.HederaFileUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  const files = await getFiles(file.user_id);

  if (files.some(acc => acc.file_id === file.file_id)) {
    throw new Error('File ID already exists!');
  }

  await prisma.hederaFile.create({
    data: file,
  });

  return await getFiles(file.user_id);
};

export const removeFile = async (userId: string, fileId: string) => {
  const prisma = getPrismaClient();

  const files = await getFiles(userId);

  if (!files.some(acc => acc.file_id === fileId)) {
    throw new Error(`File ID not found!`);
  }

  await prisma.hederaFile.deleteMany({
    where: {
      user_id: userId,
      file_id: fileId,
    },
  });

  return await getFiles(userId);
};

export const updateFile = async (
  fileId: string,
  userId: string,
  file: Prisma.HederaFileUncheckedUpdateInput,
) => {
  const prisma = getPrismaClient();

  await prisma.hederaFile.update({
    where: {
      id: fileId,
    },
    data: {
      ...file,
      user_id: userId,
    },
  });

  return await getFiles(userId);
};
