import { getPrismaClient } from '../../db';

export const getFiles = (userId: string) => {
  const prisma = getPrismaClient();

  try {
    return prisma.hederaFile.findMany({
      where: {
        user_id: userId,
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const addFile = async (userId: string, fileId: string, nickname: string = '') => {
  const prisma = getPrismaClient();

  const Files = await getFiles(userId);

  if (Files.some(acc => acc.file_id === fileId || (nickname && acc.nickname === nickname))) {
    throw new Error('File ID or Nickname already exists!');
  }

  await prisma.hederaFile.create({
    data: {
      user_id: userId,
      file_id: fileId,
      nickname: nickname,
    },
  });

  return await getFiles(userId);
};

export const removeFile = async (userId: string, fileId: string, nickname?: string) => {
  const prisma = getPrismaClient();

  const Files = await getFiles(userId);

  if (!Files.some(acc => acc.file_id === fileId || (nickname && acc.nickname === nickname))) {
    throw new Error(`File ID ${nickname && `or ${nickname}`} not found!`);
  }

  await prisma.hederaFile.deleteMany({
    where: {
      user_id: userId,
      file_id: fileId,
    },
  });

  return await getFiles(userId);
};
