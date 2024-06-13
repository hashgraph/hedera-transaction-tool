import { PrismaClient } from '@prisma/client';
import { beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

beforeEach(() => {
  mockReset(prisma);
});

const prisma = mockDeep<PrismaClient>();

export function getPrismaClient() {
  return prisma;
}

export const dbPath = 'database.db';

export default prisma;
