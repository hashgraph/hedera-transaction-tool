import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { safeStorage } from 'electron';
import { invokeIPCHandler } from '../../_utils_';
import registerClaimHandlers from '@main/modules/ipcHandlers/localUser/claim';
import registerSafeStorageHandlers from '@main/modules/ipcHandlers/localUser/safeStorage';
import { setPrismaClient } from '@main/db/prisma';
import { getUseKeychainClaim } from '@main/services/localUser/claim';
import { storeKeyPair } from '@main/services/localUser/keyPairs';
import { addOrganizationCredentials } from '@main/services/localUser/organizationCredentials';
import { decrypt } from '@main/utils/crypto';
import { STATIC_USER, USE_KEYCHAIN } from '@shared/constants';

vi.mock('@main/services/localUser', () => ({}));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  safeStorage: { encryptString: vi.fn(), decryptString: vi.fn() },
}));
let directory: string;
let prisma: PrismaClient;
beforeEach(async () => {
  vi.clearAllMocks();
  directory = await mkdtemp(join(tmpdir(), 'encryption-mode-'));
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
  registerClaimHandlers();
  registerSafeStorageHandlers();
});
afterEach(async () => {
  await prisma?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
test.each([false, true])('initializes %s exactly once through IPC', async mode => {
  await invokeIPCHandler('safeStorage:initializeUseKeychain', mode);
  expect(await getUseKeychainClaim()).toBe(mode);
  await expect(invokeIPCHandler('safeStorage:initializeUseKeychain', !mode)).rejects.toThrow();
  expect(await getUseKeychainClaim()).toBe(mode);
  expect(await prisma.claim.count({ where: { claim_key: USE_KEYCHAIN } })).toBe(1);
});
test('rejects non-boolean input without creating a user', async () => {
  await expect(invokeIPCHandler('safeStorage:initializeUseKeychain', 'true')).rejects.toThrow(
    'boolean',
  );
  expect(await prisma.user.count()).toBe(0);
});
test('concurrent initialization leaves a single immutable mode', async () => {
  const results = await Promise.allSettled([
    invokeIPCHandler('safeStorage:initializeUseKeychain', false),
    invokeIPCHandler('safeStorage:initializeUseKeychain', true),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(await prisma.claim.count({ where: { claim_key: USE_KEYCHAIN } })).toBe(1);
});
test('IPC tampering cannot change password encryption for keys or organization credentials', async () => {
  await invokeIPCHandler('safeStorage:initializeUseKeychain', false);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: STATIC_USER } });
  for (const channel of ['claim:add', 'claim:update', 'claim:remove']) {
    const args =
      channel === 'claim:remove' ? [user.id, [USE_KEYCHAIN]] : [user.id, USE_KEYCHAIN, 'true'];
    await expect(invokeIPCHandler(channel, ...args)).rejects.toThrow(
      'Security claims are immutable',
    );
  }
  await storeKeyPair(
    { user_id: user.id, index: 0, public_key: 'public', private_key: 'secret', type: 'ED25519' },
    'password',
    false,
  );
  expect(await decrypt((await prisma.keyPair.findFirstOrThrow()).private_key, 'password')).toBe(
    'secret',
  );
  const org = await prisma.organization.create({
    data: { nickname: 'org', serverUrl: 'https://example.com', key: 'key' },
  });
  await addOrganizationCredentials('email', 'org-secret', org.id, user.id, 'token', 'password');
  const credential = await prisma.organizationCredentials.findFirstOrThrow();
  expect(await decrypt(credential.password, 'password')).toBe('org-secret');
  expect(safeStorage.encryptString).not.toHaveBeenCalled();
  expect(await getUseKeychainClaim()).toBe(false);
  await expect(
    prisma.claim.create({
      data: { user_id: user.id, claim_key: USE_KEYCHAIN, claim_value: 'true' },
    }),
  ).rejects.toThrow();
});
test('migration retains the oldest row and prevents duplicates', async () => {
  const db = new Database(':memory:');
  try {
    db.exec(
      'CREATE TABLE Claim (id TEXT, user_id TEXT, claim_key TEXT, claim_value TEXT, created_at INTEGER)',
    );
    db.exec(
      "INSERT INTO Claim VALUES ('b','u','use_keychain','true',2), ('a','u','use_keychain','false',1), ('c','u','use_keychain','true',1)",
    );
    db.exec(
      await readFile(
        'prisma/migrations/20261020120000_unique_claim_per_user/migration.sql',
        'utf8',
      ),
    );
    expect(db.prepare('SELECT id, claim_value FROM Claim').all()).toEqual([
      { id: 'a', claim_value: 'false' },
    ]);
    expect(() => db.exec("INSERT INTO Claim VALUES ('d','u','use_keychain','true',3)")).toThrow();
  } finally {
    db.close();
  }
});

test('failed initialization rolls back the static user as well as the claim', async () => {
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_mode BEFORE INSERT ON Claim
    BEGIN SELECT RAISE(ABORT, 'simulated initialization failure'); END`);
  await expect(invokeIPCHandler('safeStorage:initializeUseKeychain', false)).rejects.toThrow();
  expect(await prisma.user.count()).toBe(0);
  expect(await prisma.claim.count()).toBe(0);
});

test('initialization can recover an existing static user without replacing it', async () => {
  const user = await prisma.user.create({
    data: { email: STATIC_USER, password: 'existing-hash' },
  });
  await invokeIPCHandler('safeStorage:initializeUseKeychain', false);
  expect(await prisma.user.findUnique({ where: { id: user.id } })).toEqual(user);
  expect(await getUseKeychainClaim()).toBe(false);
});
