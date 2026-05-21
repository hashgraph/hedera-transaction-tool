import { Client } from '@hiero-ledger/sdk';

import { getClientFromNetwork } from '../utils/sdk';

import { HederaClientPool } from './hedera-client-pool.service';

jest.mock('../utils/sdk/client', () => ({
  ...jest.requireActual('../utils/sdk/client'),
  getClientFromNetwork: jest.fn(),
}));

describe('HederaClientPool', () => {
  const makeClient = (): Client => ({ close: jest.fn() } as unknown as Client);

  let pool: HederaClientPool;
  const idleMs = 50;

  beforeEach(() => {
    jest.resetAllMocks();
    pool = new HederaClientPool(idleMs);
  });

  afterEach(async () => {
    await pool.onModuleDestroy();
  });

  it('builds a client on first acquire and reuses it on the second acquire', async () => {
    const client = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

    const a = await pool.acquire('testnet');
    const b = await pool.acquire('testnet');

    expect(a).toBe(client);
    expect(b).toBe(client);
    expect(getClientFromNetwork).toHaveBeenCalledTimes(1);
  });

  it('shares one client across concurrent acquires of the same network', async () => {
    const client = makeClient();
    let resolve!: (c: Client) => void;
    jest.mocked(getClientFromNetwork).mockReturnValueOnce(
      new Promise<Client>(r => {
        resolve = r;
      }),
    );

    const p1 = pool.acquire('testnet');
    const p2 = pool.acquire('testnet');
    resolve(client);

    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe(client);
    expect(b).toBe(client);
    expect(getClientFromNetwork).toHaveBeenCalledTimes(1);
  });

  it('keeps separate clients per network', async () => {
    const testnetClient = makeClient();
    const mainnetClient = makeClient();
    jest
      .mocked(getClientFromNetwork)
      .mockResolvedValueOnce(testnetClient)
      .mockResolvedValueOnce(mainnetClient);

    const t = await pool.acquire('testnet');
    const m = await pool.acquire('mainnet');

    expect(t).toBe(testnetClient);
    expect(m).toBe(mainnetClient);
  });

  it('normalizes the network key (case-insensitive)', async () => {
    const client = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

    await pool.acquire('TESTNET');
    await pool.acquire('testnet');

    expect(getClientFromNetwork).toHaveBeenCalledTimes(1);
  });

  it('does not close the client while another caller still holds it', async () => {
    const client = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

    await pool.acquire('testnet');
    await pool.acquire('testnet');
    pool.release('testnet');

    // Wait past the idle window; second holder should still keep it alive.
    await new Promise(r => setTimeout(r, idleMs + 20));
    expect(client.close).not.toHaveBeenCalled();
  });

  it('closes after idle window once all callers release', async () => {
    const client = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

    await pool.acquire('testnet');
    pool.release('testnet');

    await new Promise(r => setTimeout(r, idleMs + 20));
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('cancels the idle timer when a new caller acquires before it fires', async () => {
    const client = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

    await pool.acquire('testnet');
    pool.release('testnet');

    // Re-acquire before idle window elapses.
    await new Promise(r => setTimeout(r, idleMs / 2));
    const reAcquired = await pool.acquire('testnet');

    // Wait past the original idle window — the previous timer should be canceled.
    await new Promise(r => setTimeout(r, idleMs + 20));
    expect(reAcquired).toBe(client);
    expect(client.close).not.toHaveBeenCalled();
    // We didn't build a new client.
    expect(getClientFromNetwork).toHaveBeenCalledTimes(1);
  });

  it('rebuilds a fresh client if used again after closing', async () => {
    const firstClient = makeClient();
    const secondClient = makeClient();
    jest
      .mocked(getClientFromNetwork)
      .mockResolvedValueOnce(firstClient)
      .mockResolvedValueOnce(secondClient);

    await pool.acquire('testnet');
    pool.release('testnet');
    await new Promise(r => setTimeout(r, idleMs + 20));
    expect(firstClient.close).toHaveBeenCalled();

    const second = await pool.acquire('testnet');
    expect(second).toBe(secondClient);
    expect(getClientFromNetwork).toHaveBeenCalledTimes(2);
  });

  it('evicts a failed build so the next acquire retries', async () => {
    jest.mocked(getClientFromNetwork).mockRejectedValueOnce(new Error('boom'));
    const recovered = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(recovered);

    await expect(pool.acquire('testnet')).rejects.toThrow('boom');

    const second = await pool.acquire('testnet');
    expect(second).toBe(recovered);
    expect(getClientFromNetwork).toHaveBeenCalledTimes(2);
  });

  it('withClient acquires, runs the callback, and releases', async () => {
    const client = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

    const result = await pool.withClient('testnet', async c => {
      expect(c).toBe(client);
      return 'ok';
    });

    expect(result).toBe('ok');
    // After release with no other holders, the idle timer should be scheduled
    // (but not yet fired).
    expect(client.close).not.toHaveBeenCalled();

    await new Promise(r => setTimeout(r, idleMs + 20));
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('withClient releases even if the callback throws', async () => {
    const client = makeClient();
    jest.mocked(getClientFromNetwork).mockResolvedValueOnce(client);

    await expect(
      pool.withClient('testnet', async () => {
        throw new Error('callback failed');
      }),
    ).rejects.toThrow('callback failed');

    await new Promise(r => setTimeout(r, idleMs + 20));
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('closes all clients on onModuleDestroy', async () => {
    const testnetClient = makeClient();
    const mainnetClient = makeClient();
    jest
      .mocked(getClientFromNetwork)
      .mockResolvedValueOnce(testnetClient)
      .mockResolvedValueOnce(mainnetClient);

    await pool.acquire('testnet');
    await pool.acquire('mainnet');

    await pool.onModuleDestroy();

    expect(testnetClient.close).toHaveBeenCalledTimes(1);
    expect(mainnetClient.close).toHaveBeenCalledTimes(1);
  });
});
