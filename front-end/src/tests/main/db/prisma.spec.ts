import { MockedObject } from 'vitest';

import {
  getDatabasePath,
  getPrismaClient,
  setPrismaClient,
  createPrismaClient,
} from '@main/db/prisma';

import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { app } from 'electron';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  app: { getPath: vi.fn() },
}));

vi.mock('path', () => ({
  join: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}));

describe('Database path', () => {
  const appMO = app as unknown as MockedObject<Electron.App>;
  const pathJoinMO = vi.mocked(path.join);

  beforeEach(() => {
    vi.clearAllMocks();
    appMO.getPath.mockReturnValue('user-data-path');
    pathJoinMO.mockReturnValue('user-data-path/database.db');
  });

  test('Should get the database path', () => {
    expect(getDatabasePath()).toBe('user-data-path/database.db');
    expect(appMO.getPath).toHaveBeenCalledWith('userData');
    expect(pathJoinMO).toHaveBeenCalledWith('user-data-path', 'database.db');
  });
});

describe('Prisma client', () => {
  const PrismaClientMO = PrismaClient as unknown as MockedObject<typeof PrismaClient>;
  const appMO = app as unknown as MockedObject<Electron.App>;
  const pathJoinMO = vi.mocked(path.join);

  beforeEach(() => {
    vi.clearAllMocks();
    appMO.getPath.mockReturnValue('user-data-path');
    pathJoinMO.mockReturnValue('user-data-path/database.db');
  });

  test('Should create Prisma client', () => {
    const client = createPrismaClient();
    expect(PrismaClientMO).toHaveBeenCalledWith({
      datasources: {
        db: {
          url: 'file:user-data-path/database.db',
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
