/**
 * Wires the real preload API -> (simulated) Electron IPC -> real IPC handlers -> real service ->
 * real SQLite database, so a renamed channel, a reordered argument or a payload that does not
 * survive IPC serialization fails here instead of only in the packaged app.
 *
 * Only the Electron process boundary itself is simulated (see the `electron` mock below).
 */
import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import registerAccountsHandlers from '@main/modules/ipcHandlers/localUser/accounts';
import { setPrismaClient } from '@main/db/prisma';

import accountsPreload from '../../../preload/localUser/accounts';

const ipc = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      ipc.handlers.set(channel, handler);
    },
  },
  ipcRenderer: {
    // Mimics Electron: arguments and results cross the boundary through structured clone, and a
    // handler error reaches the renderer wrapped in "Error invoking remote method ...".
    invoke: async (channel: string, ...args: unknown[]) => {
      const handler = ipc.handlers.get(channel);
      if (!handler) {
        throw new Error(`Error invoking remote method '${channel}': No handler registered`);
      }
      try {
        return structuredClone(await handler({}, ...structuredClone(args)));
      } catch (error) {
        throw new Error(`Error invoking remote method '${channel}': ${error}`);
      }
    },
  },
}));

const { accounts } = accountsPreload;

let directory: string;
let prisma: PrismaClient;
let userId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'accounts-ipc-'));
  const filename = join(directory, 'test.db');

  const db = new Database(filename);
  for (const migration of (await readdir('prisma/migrations')).sort()) {
    if (migration === 'migration_lock.toml') continue;
    if (!(await readdir(join('prisma/migrations', migration))).includes('migration.sql')) continue;
    db.exec(await readFile(join('prisma/migrations', migration, 'migration.sql'), 'utf8'));
  }
  db.close();

  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${filename}` }) });
  setPrismaClient(prisma);
  userId = (await prisma.user.create({ data: { email: 'user@test.com', password: 'x' } })).id;

  ipc.handlers.clear();
  registerAccountsHandlers();
});

afterEach(async () => {
  await prisma?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('accounts: preload -> IPC -> handlers -> service -> database', () => {
  test('links an account and returns it in the user list', async () => {
    const result = await accounts.add(userId, '0.0.1180', 'testnet', '');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      user_id: userId,
      account_id: '0.0.1180',
      network: 'testnet',
      nickname: null,
    });
    expect(result[0].created_at).toBeInstanceOf(Date);

    expect(await prisma.hederaAccount.count()).toBe(1);
    expect(await accounts.getOne(userId, '0.0.1180')).toMatchObject({ account_id: '0.0.1180' });
    expect(await accounts.getAll({ where: { user_id: userId } })).toHaveLength(1);
  });

  test('rejects linking the same account twice with the duplicate message', async () => {
    await accounts.add(userId, '0.0.1180', 'testnet', '');

    await expect(accounts.add(userId, '0.0.1180', 'testnet', 'other')).rejects.toThrow(
      'Account ID or Nickname already exists!',
    );
    expect(await prisma.hederaAccount.count()).toBe(1);
  });

  test('allows the same account id on a different network', async () => {
    await accounts.add(userId, '0.0.1180', 'testnet', '');
    await accounts.add(userId, '0.0.1180', 'mainnet', '');

    expect(await prisma.hederaAccount.count()).toBe(2);
  });

  test('rejects a nickname that is already used on the same network', async () => {
    await accounts.add(userId, '0.0.1180', 'testnet', 'savings');

    await expect(accounts.add(userId, '0.0.1181', 'testnet', 'savings')).rejects.toThrow(
      'Account ID or Nickname already exists!',
    );
  });

  test('changes and clears a nickname', async () => {
    await accounts.add(userId, '0.0.1180', 'testnet', '');

    const renamed = await accounts.changeNickname(userId, '0.0.1180', 'savings');
    expect(renamed[0].nickname).toBe('savings');

    const cleared = await accounts.changeNickname(userId, '0.0.1180', '');
    expect(cleared[0].nickname).toBeNull();
  });

  test('unlinks several accounts at once', async () => {
    await accounts.add(userId, '0.0.1180', 'testnet', '');
    await accounts.add(userId, '0.0.1181', 'testnet', '');
    await accounts.add(userId, '0.0.1182', 'testnet', '');

    await accounts.remove(userId, ['0.0.1180', '0.0.1182']);

    const remaining = await accounts.getAll({ where: { user_id: userId } });
    expect(remaining.map(a => a.account_id)).toEqual(['0.0.1181']);
  });

  test('does not leak accounts between users', async () => {
    const otherId = (await prisma.user.create({ data: { email: 'other@test.com', password: 'x' } }))
      .id;
    await accounts.add(userId, '0.0.1180', 'testnet', '');

    expect(await accounts.getOne(otherId, '0.0.1180')).toBeNull();
    await expect(accounts.add(otherId, '0.0.1180', 'testnet', '')).resolves.toHaveLength(1);
  });
});
