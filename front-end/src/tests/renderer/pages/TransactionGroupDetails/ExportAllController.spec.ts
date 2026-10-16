// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import JSZip from 'jszip';
import { AccountId, PrivateKey, TransactionId, TransferTransaction } from '@hiero-ledger/sdk';

import type { IGroup } from '@renderer/services/organization';
import ExportAllController from '@renderer/pages/TransactionGroupDetails/ExportAllController.vue';
import { getTransactionGroupById } from '@renderer/services/organization';
import { exportFilesWithDialog } from '@renderer/services/electronUtilsService.ts';

/* ── ActionController stub ──────────────────────────────────────────────── */

const capture = vi.hoisted(() => ({
  callback: null as ((pw: string | null) => Promise<unknown>) | null,
}));

vi.mock('@renderer/components/ActionController/ActionController.vue', () => ({
  default: {
    props: ['actionCallback', 'activate', 'progressText'],
    setup(props: any) {
      capture.callback = props.actionCallback;
    },
    template: '<div />',
  },
}));

/* ── Dependency mocks ───────────────────────────────────────────────────── */

const toastSuccess = vi.fn();
const toastError = vi.fn();
const userStore = vi.hoisted(() => ({
  personal: { id: 'user-1' } as any,
  selectedOrganization: { serverUrl: 'https://org.example.com' } as any,
  publicKeys: ['pub-key'] as string[],
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => userStore) }));

vi.mock('@renderer/utils/ToastManager.ts', () => ({
  ToastManager: { inject: vi.fn(() => ({ success: toastSuccess, error: toastError })) },
}));

vi.mock('@renderer/services/keyPairService.ts', () => ({
  decryptPrivateKey: vi.fn().mockResolvedValue('raw-key'),
}));

vi.mock('@renderer/services/electronUtilsService.ts', () => ({
  exportFilesWithDialog: vi.fn().mockResolvedValue(true),
}));

vi.mock('@renderer/services/organization', () => ({
  getTransactionGroupById: vi.fn(),
}));

const privateKey = PrivateKey.generateED25519();
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertUserLoggedIn: vi.fn(),
  assertIsLoggedInOrganization: vi.fn(),
  getPrivateKey: vi.fn(() => privateKey),
}));

/* ── Helpers ────────────────────────────────────────────────────────────── */

const makeTx = (id: number) => {
  const sdkTx = new TransferTransaction()
    .setTransactionId(TransactionId.generate(new AccountId(0, 0, 1000 + id)))
    .setNodeAccountIds([new AccountId(0, 0, 3)])
    .freeze();
  return {
    id,
    transactionId: sdkTx.transactionId!.toString(),
    transactionBytes: Buffer.from(sdkTx.toBytes()).toString('hex'),
    creatorEmail: `creator${id}@example.com`,
    description: `Transaction ${id}`,
    createdAt: '2024-06-15T12:00:00.000Z',
  } as any;
};

const makeGroup = (count: number): IGroup => ({
  id: 7,
  description: 'My group',
  atomic: false,
  sequential: false,
  createdAt: new Date().toISOString(),
  groupValidStart: new Date().toISOString(),
  groupItems: Array.from({ length: count }, (_, i) => {
    const tx = makeTx(i + 1);
    return { seq: i + 1, transactionId: tx.id, transaction: tx };
  }),
});

/* ── Tests ──────────────────────────────────────────────────────────────── */

describe('ExportAllController', () => {
  const mockCallback = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    capture.callback = null;
    userStore.publicKeys = ['pub-key'];
    mockCallback.mockResolvedValue(undefined);
    vi.mocked(exportFilesWithDialog).mockResolvedValue(true);
  });

  const mountAndCapture = (groupOrId: IGroup | number | null) => {
    mount(ExportAllController, {
      props: { groupOrId, callback: mockCallback, activate: false },
    });
    if (!capture.callback) throw new Error('ActionController stub did not capture actionCallback');
    return capture.callback;
  };

  test('exports a .tx and .txt file per group item using the transactions embedded in the group', async () => {
    const group = makeGroup(3);
    const exportAll = mountAndCapture(group);

    await exportAll('password');
    await flushPromises();

    expect(getTransactionGroupById).not.toHaveBeenCalled();
    expect(exportFilesWithDialog).toHaveBeenCalledTimes(1);

    const [files, defaultName] = vi.mocked(exportFilesWithDialog).mock.calls[0];
    expect(defaultName).toBe('My group.zip');

    const zip = await JSZip.loadAsync((files as any)[0].data);
    const names = Object.keys(zip.files);
    expect(names.filter(n => n.endsWith('.tx'))).toHaveLength(3);
    expect(names.filter(n => n.endsWith('.txt'))).toHaveLength(3);

    const txtName = names.find(n => n.endsWith('.txt'))!;
    const json = JSON.parse(await zip.file(txtName)!.async('string'));
    expect(json.Author).toMatch(/^creator\d@example\.com$/);
    expect(json.Contents).toMatch(/^Transaction \d$/);

    expect(toastSuccess).toHaveBeenCalledWith('Transaction exported successfully');
    expect(mockCallback).toHaveBeenCalledWith(group.id);
  });

  test('loads the group by id when given a number', async () => {
    vi.mocked(getTransactionGroupById).mockResolvedValue(makeGroup(2));
    const exportAll = mountAndCapture(7);

    await exportAll('password');
    await flushPromises();

    expect(getTransactionGroupById).toHaveBeenCalledWith('https://org.example.com', 7);
    const [files] = vi.mocked(exportFilesWithDialog).mock.calls[0];
    const zip = await JSZip.loadAsync((files as any)[0].data);
    expect(Object.keys(zip.files)).toHaveLength(4);
  });

  test('shows an error and does not export when the user has no key pair', async () => {
    userStore.publicKeys = [];
    const exportAll = mountAndCapture(makeGroup(1));

    await exportAll('password');
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('requires a signature'));
    expect(exportFilesWithDialog).not.toHaveBeenCalled();
  });

  test('shows an error toast and still reloads the group when export fails', async () => {
    vi.mocked(exportFilesWithDialog).mockRejectedValue(new Error('disk full'));
    const group = makeGroup(1);
    const exportAll = mountAndCapture(group);

    await exportAll('password');
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith('Transactions not exported');
    expect(mockCallback).toHaveBeenCalledWith(group.id);
  });
});
