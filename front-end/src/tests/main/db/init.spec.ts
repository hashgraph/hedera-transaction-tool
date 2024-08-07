import { MockedObject } from 'vitest';

import initDatabase, { deleteDatabase } from '@main/db/init';
import prisma from '@main/db/__mocks__/prisma';

import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import electron from 'electron';
import * as sqlite3 from 'better-sqlite3';
import { getDatabaseLogger } from '@main/modules/logger';

vi.mock('@main/db/prisma');

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  default: {
    app: { getPath: vi.fn(), getAppPath: vi.fn() },
  },
}));
vi.mock('path', () => ({
  default: {
    join: vi.fn(),
  },
}));
vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockReturnValue({
    prepare: vi.fn(() => ({
      run: vi.fn(),
    })),
    exec: vi.fn(),
    inTransaction: true,
  }),
}));
vi.mock('fsp', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}));
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn(),
  },
}));
vi.mock('@main/modules/logger', () => ({
  getDatabaseLogger: vi.fn(() => ({
    errorHandler: {
      startCatching: vi.fn(),
      stopCatching: vi.fn(),
    },
    transports: {
      console: {
        format: '',
      },
    },
    log: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('Initialize database', () => {
  const appMO = electron.app as unknown as MockedObject<Electron.App>;

  test('Should apply first migration if database does not exists', async () => {
    const mockAppPath = '/mock/path';
    appMO.getAppPath.mockReturnValue(mockAppPath);
    vi.mocked(path.join).mockReturnValue('/mock/path/migrations');

    prisma.migration.findFirst.mockResolvedValue(null);

    vi.spyOn(fsp, 'readdir')
      .mockResolvedValueOnce(['20240207141145_init'] as unknown as any)
      .mockResolvedValueOnce(['migration.sql'] as unknown as any);
    vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.spyOn(fsp, 'readFile').mockResolvedValueOnce('CREATE TABLE test;');

    await initDatabase();

    const sqliteInstance = vi.mocked(sqlite3.default).mock.results[0].value;
    const loggerResult = vi.mocked(getDatabaseLogger).mock.results[0].value;

    expect(loggerResult.errorHandler.startCatching).toHaveBeenCalled();
    expect(loggerResult.errorHandler.stopCatching).toHaveBeenCalled();
    expect(loggerResult.log).toHaveBeenCalledWith('Current migration: ');
    expect(loggerResult.log).toHaveBeenNthCalledWith(2, 'Applying migration: 20240207141145_init');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('BEGIN');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('COMMIT');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('ROLLBACK');
    expect(sqliteInstance.exec).toHaveBeenCalledWith('CREATE TABLE test;');
    expect(loggerResult.log).toHaveBeenCalledWith('Database ready for usage');

    vi.mocked(getDatabaseLogger).mockClear();
  });

  test('Should apply migration if new available', async () => {
    const mockAppPath = '/mock/path';
    appMO.getAppPath.mockReturnValue(mockAppPath);
    vi.mocked(path.join).mockReturnValue('/mock/path/migrations');

    prisma.migration.findFirst.mockResolvedValue({
      id: 1,
      name: '20240207141145_init',
      created_at: 1707315105,
    });

    vi.spyOn(fsp, 'readdir')
      .mockResolvedValueOnce([
        '20240207141145_init',
        '20240208114842_add_something',
      ] as unknown as any)
      .mockResolvedValueOnce(['migration.sql'] as unknown as any)
      .mockResolvedValueOnce(['migration.sql'] as unknown as any);
    vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.spyOn(fsp, 'readFile')
      .mockResolvedValueOnce('CREATE TABLE test;')
      .mockResolvedValueOnce('ALTER TABLE test;');

    await initDatabase();

    const sqliteInstance = vi.mocked(sqlite3.default).mock.results[0].value;
    const loggerResult = vi.mocked(getDatabaseLogger).mock.results[0].value;

    expect(loggerResult.errorHandler.startCatching).toHaveBeenCalled();
    expect(loggerResult.errorHandler.stopCatching).toHaveBeenCalled();
    expect(loggerResult.log).toHaveBeenCalledWith('Current migration: 20240207141145_init');
    expect(loggerResult.log).toHaveBeenNthCalledWith(
      2,
      'Applying migration: 20240208114842_add_something',
    );
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('BEGIN');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('COMMIT');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('ROLLBACK');
    expect(sqliteInstance.exec).toHaveBeenCalledWith('ALTER TABLE test;');
    expect(loggerResult.log).toHaveBeenCalledWith('Database ready for usage');

    vi.mocked(getDatabaseLogger).mockClear();
  });

  test('Should rollback if a migration fail', async () => {
    const mockAppPath = '/mock/path';
    appMO.getAppPath.mockReturnValue(mockAppPath);
    vi.mocked(path.join).mockReturnValue('/mock/path/migrations');

    prisma.migration.findFirst.mockResolvedValue({
      id: 1,
      name: '20240207141145_init',
      created_at: 1707315105,
    });

    vi.spyOn(fsp, 'readdir')
      .mockResolvedValueOnce([
        '20240207141145_init',
        '20240208114842_add_something',
      ] as unknown as any)
      .mockResolvedValueOnce(['migration.sql'] as unknown as any)
      .mockResolvedValueOnce(['migration.sql'] as unknown as any);
    vi.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.spyOn(fsp, 'readFile')
      .mockResolvedValueOnce('CREATE TABLE test;')
      .mockResolvedValueOnce('ALTER TABLE test;');

    const sqliteInstance = vi.mocked(sqlite3.default).mock.results[0].value;

    sqliteInstance.exec.mockRejectedValueOnce(new Error('SQL Error'));

    await initDatabase();

    const loggerResult = vi.mocked(getDatabaseLogger).mock.results[0].value;

    expect(loggerResult.log).toHaveBeenCalledWith('Current migration: 20240207141145_init');
    expect(loggerResult.log).toHaveBeenNthCalledWith(
      2,
      'Applying migration: 20240208114842_add_something',
    );
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('BEGIN');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('COMMIT');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('ROLLBACK');
    expect(sqliteInstance.exec).toHaveBeenCalledWith('ALTER TABLE test;');
    expect(
      sqliteInstance.prepare.mock.results[sqliteInstance.prepare.mock.results.length - 1].value.run,
    ).toHaveBeenCalled(); // Prepared Rollback
    expect(loggerResult.error).toHaveBeenCalledWith(new Error('SQL Error'));

    vi.mocked(getDatabaseLogger).mockClear();
  });

  test('Should log error if fail to process a available migration', async () => {
    const mockAppPath = '/mock/path';
    appMO.getAppPath.mockReturnValue(mockAppPath);
    vi.mocked(path.join).mockReturnValue('/mock/path/migrations');

    prisma.migration.findFirst.mockResolvedValue({
      id: 1,
      name: '20240207141145_init',
      created_at: 1707315105,
    });

    vi.spyOn(fsp, 'readdir')
      .mockResolvedValueOnce([
        '20240207141145_init',
        '20240208114842_add_something',
      ] as unknown as any)
      .mockResolvedValueOnce(['migration.sql'] as unknown as any)
      .mockResolvedValueOnce(['migration.sql'] as unknown as any);
    vi.spyOn(fs, 'statSync')
      .mockReturnValueOnce({ isDirectory: () => true } as fs.Stats)
      .mockImplementationOnce(() => {
        throw new Error('File Error');
      });
    vi.spyOn(fsp, 'readFile').mockResolvedValueOnce('CREATE TABLE test;');

    const sqliteInstance = vi.mocked(sqlite3.default).mock.results[0].value;

    sqliteInstance.exec.mockRejectedValueOnce(new Error('SQL Error'));

    await initDatabase();

    const loggerResult = vi.mocked(getDatabaseLogger).mock.results[0].value;

    expect(loggerResult.log).toHaveBeenCalledWith('Current migration: 20240207141145_init');
    expect(loggerResult.log).toHaveBeenNthCalledWith(2, 'Database ready for usage');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('BEGIN');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('COMMIT');
    expect(sqliteInstance.prepare).toHaveBeenCalledWith('ROLLBACK');
    expect(sqliteInstance.exec).toHaveBeenCalledWith('ALTER TABLE test;');
    expect(loggerResult.error).toHaveBeenCalledWith(new Error('File Error'));

    vi.mocked(getDatabaseLogger).mockClear();
  });

  test('Should disconnect from prisma and return null if there is an error during fetching current migration', async () => {
    const mockAppPath = '/mock/path';
    appMO.getAppPath.mockReturnValue(mockAppPath);
    vi.mocked(path.join).mockReturnValue('/mock/path/migrations');

    prisma.migration.findFirst.mockRejectedValue(new Error('Prisma Error'));

    const sqliteInstance = vi.mocked(sqlite3.default).mock.results[0].value;

    sqliteInstance.exec.mockRejectedValueOnce(new Error('SQL Error'));

    await initDatabase();

    const loggerResult = vi.mocked(getDatabaseLogger).mock.results[0].value;

    expect(prisma.$disconnect).toHaveBeenCalled();
    expect(loggerResult.log).toHaveBeenCalledWith('Current migration: ');

    vi.mocked(getDatabaseLogger).mockClear();
  });

  test('migrationsPath', async () => {
    appMO.getAppPath.mockReturnValue('');
    vi.mocked(path.join).mockImplementation((...args) => args.join(''));

    import.meta.env.DEV = true;

    await initDatabase();

    expect(vi.mocked(fsp.readdir)).toHaveBeenCalledWith('./prisma/migrations');

    import.meta.env.DEV = false;

    await initDatabase();

    expect(vi.mocked(fsp.readdir)).toHaveBeenCalledWith('./prisma/migrations');

    import.meta.env.DEV = true;

    vi.mocked(getDatabaseLogger).mockClear();
  });
});

describe('Delete database', () => {
  test('Should delete database file', async () => {
    vi.spyOn(fsp, 'rm').mockResolvedValueOnce(undefined);

    await deleteDatabase();

    const loggerResult = vi.mocked(getDatabaseLogger).mock.results[0].value;

    expect(loggerResult.log).toHaveBeenCalledWith('Database deleted successfully');
    expect(fsp.rm).toHaveBeenCalled();

    vi.mocked(getDatabaseLogger).mockClear();
  });

  test('Should log the error if fails to delete database file', async () => {
    vi.spyOn(fsp, 'rm').mockRejectedValue(new Error('File Error'));

    await deleteDatabase();

    const loggerResult = vi.mocked(getDatabaseLogger).mock.results[0].value;

    expect(loggerResult.error).toHaveBeenCalledWith(new Error('File Error'));
    expect(fsp.rm).toHaveBeenCalled();

    vi.mocked(getDatabaseLogger).mockClear();
  });
});
