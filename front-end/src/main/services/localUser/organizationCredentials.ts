import { getPrismaClient } from '@main/db';

import { Prisma } from '@prisma/client';

export const getShouldLoginTo = async (user_id: string) => {
  const prisma = getPrismaClient();

  try {
    return await prisma.organization.findMany();
  } catch (error) {
    console.log(error);
    return [];
  }
};
