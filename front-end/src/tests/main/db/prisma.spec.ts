import { MockedObject } from 'vitest';

import { getPrismaClient, setPrismaClient, createPrismaClient, dbPath } from '@main/db/prisma';

import path from 'path';
import { PrismaClient } from '@prisma/client';
import electron from 'electron';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  default: {
    app: { getPath: vi.fn() },
  },
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn(),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}));

describe('Database path', () => {
  const appMO = electron.app as unknown as MockedObject<Electron.App>;

  test('Should get the database path', () => {
    appMO.getPath.mockReturnValue('user-data-path');
    const dbPath = path.join('user-data-path', 'database.db');

    expect(dbPath).toBe(dbPath);
  });
});

describe('Prisma client', () => {
  const PrismaClientMO = PrismaClient as unknown as MockedObject<typeof PrismaClient>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Should create Prisma client', () => {
    const client = createPrismaClient();
    expect(PrismaClientMO).toHaveBeenCalledWith({
      datasources: {
        db: {
          url: `file:${dbPath}`,
        },
      },
    });
    expect(client).toBeDefined();
  });

  test('Should get Prisma client', () => {
    const client = getPrismaClient();
    expect(client).toBeDefined();
    expect(PrismaClientMO).toHaveBeenCalledTimes(1);
  });

  test('Should set Prisma client', () => {
    const newClient = new PrismaClient();
    setPrismaClient(newClient);
    const client = getPrismaClient();
    expect(client).toBe(newClient);
    expect(PrismaClientMO).toHaveBeenCalledTimes(1);
  });

  test('Should get the same Prisma client on subsequent calls', () => {
    const client1 = getPrismaClient();
    const client2 = getPrismaClient();
    expect(client1).toBe(client2);
    expect(PrismaClientMO).toHaveBeenCalledTimes(0);
  });
});
