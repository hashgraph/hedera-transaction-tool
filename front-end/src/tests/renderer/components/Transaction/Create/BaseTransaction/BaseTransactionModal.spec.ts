// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  routeQuery: {},
  routeParams: {},
  push: vi.fn(),
  leaveGuard: null as null | ((to: { fullPath: string; name?: string }) => Promise<boolean>),
  personal: null as null | { id: string; isLoggedIn: boolean },
  addDraft: vi.fn(),
  updateDraft: vi.fn(),
  getDraft: vi.fn(),
  draftExists: vi.fn(),
  success: vi.fn(),
  loggerError: vi.fn(),
  getTransactionFromBytes: vi.fn(),
  clearGroup: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mocks.routeQuery,
    params: mocks.routeParams,
    path: '/create-transaction/x',
  }),
  useRouter: () => ({ push: mocks.push }),
  onBeforeRouteLeave: (guard: typeof mocks.leaveGuard) => {
    mocks.leaveGuard = guard;
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ personal: mocks.personal }),
}));
vi.mock('@renderer/stores/storeTransactionGroup', () => ({
  default: () => ({ clearGroup: mocks.clearGroup }),
}));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: mocks.success }) },
}));
vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError }),
}));
vi.mock('@renderer/services/transactionDraftsService', () => ({
  addDraft: mocks.addDraft,
  updateDraft: mocks.updateDraft,
  getDraft: mocks.getDraft,
  draftExists: mocks.draftExists,
}));
vi.mock('@renderer/utils', () => ({
  getTransactionFromBytes: mocks.getTransactionFromBytes,
  isUserLoggedIn: (user: { isLoggedIn: boolean } | null) => user !== null && user.isLoggedIn,
}));

import BaseTransactionModal from '@renderer/components/Transaction/Create/BaseTransaction/BaseTransactionModal.vue';

const bytes = new Uint8Array([1, 2, 3]);

function mountModal(props: Record<string, unknown> = {}) {
  return mount(BaseTransactionModal, {
    props: {
      getTransaction: () => ({ toBytes: () => bytes }) as any,
      description: 'desc',
      hasDataChanged: true,
      ...props,
    },
    global: {
      stubs: {
        AppModal: { template: '<div><slot /></div>' },
        AppButton: { template: '<button><slot /></button>' },
        AppCustomIcon: true,
      },
    },
  });
}

/** Opens the "Save Draft?" prompt by simulating a route leave, then submits it. */
async function leaveAndSave(wrapper: ReturnType<typeof mountModal>) {
  expect(await mocks.leaveGuard!({ fullPath: '/next', name: 'transactions' })).toBe(false);
  await wrapper.find('form').trigger('submit');
  await flushPromises();
}

describe('BaseTransactionModal.vue', () => {
  beforeEach(() => {
    mocks.routeQuery = {};
    mocks.routeParams = {};
    mocks.personal = { id: 'user-1', isLoggedIn: true };
    mocks.leaveGuard = null;
    for (const m of [
      mocks.push,
      mocks.addDraft,
      mocks.updateDraft,
      mocks.getDraft,
      mocks.draftExists,
      mocks.success,
      mocks.loggerError,
      mocks.getTransactionFromBytes,
      mocks.clearGroup,
    ]) {
      m.mockReset();
    }
    mocks.draftExists.mockResolvedValue(false);
  });

  test('saves a new draft with the submit-manually state', async () => {
    const wrapper = mountModal({ submitManually: true });

    await leaveAndSave(wrapper);

    expect(mocks.addDraft).toHaveBeenCalledWith('user-1', bytes, 'desc', undefined, true);
    expect(mocks.success).toHaveBeenCalledWith('Draft saved');
    expect(mocks.push).toHaveBeenCalledWith('/next');
  });

  test('defaults submit-manually to false for a new draft', async () => {
    const wrapper = mountModal();

    await leaveAndSave(wrapper);

    expect(mocks.addDraft).toHaveBeenCalledWith('user-1', bytes, 'desc', undefined, false);
  });

  test('updates an existing draft with the submit-manually state when the bytes differ', async () => {
    mocks.routeQuery = { draftId: 'draft-1' };
    mocks.getDraft.mockResolvedValue({ id: 'draft-1', transactionBytes: '0x00' });
    mocks.getTransactionFromBytes.mockReturnValue({ toBytes: () => new Uint8Array([9]) });
    const wrapper = mountModal({ submitManually: true });

    await leaveAndSave(wrapper);

    expect(mocks.updateDraft).toHaveBeenCalledWith('draft-1', {
      transactionBytes: bytes.toString(),
      description: 'desc',
      submitManually: true,
    });
    expect(mocks.success).toHaveBeenCalledWith('Draft updated');
    expect(mocks.push).toHaveBeenCalledWith('/next');
  });

  test('defaults submit-manually to false when updating', async () => {
    mocks.routeQuery = { draftId: 'draft-1' };
    mocks.getDraft.mockResolvedValue({ id: 'draft-1', transactionBytes: '0x00' });
    mocks.getTransactionFromBytes.mockReturnValue({ toBytes: () => new Uint8Array([9]) });
    const wrapper = mountModal();

    await leaveAndSave(wrapper);

    expect(mocks.updateDraft.mock.calls[0][1]).toMatchObject({ submitManually: false });
  });

  test('does not update when the transaction bytes are unchanged', async () => {
    mocks.routeQuery = { draftId: 'draft-1' };
    mocks.getDraft.mockResolvedValue({ id: 'draft-1', transactionBytes: '0x00' });
    mocks.getTransactionFromBytes.mockReturnValue({ toBytes: () => bytes });
    const wrapper = mountModal({ submitManually: true });

    await leaveAndSave(wrapper);

    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });

  test('logs and does not navigate when saving fails', async () => {
    mocks.addDraft.mockRejectedValue(new Error('boom'));
    const wrapper = mountModal();

    await leaveAndSave(wrapper);

    expect(mocks.loggerError).toHaveBeenCalledWith('Failed to save draft', expect.anything());
    expect(mocks.push).not.toHaveBeenCalled();
  });

  test('throws when saving while logged out', async () => {
    mocks.personal = null;
    const wrapper = mountModal();
    await mocks.leaveGuard!({ fullPath: '/next', name: 'transactions' });
    const errors: unknown[] = [];
    wrapper.vm.$.appContext.config.errorHandler = err => errors.push(err);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.addDraft).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
  });

  test('discard navigates without saving', async () => {
    const wrapper = mountModal();
    await mocks.leaveGuard!({ fullPath: '/next', name: 'transactions' });

    await wrapper.find('[data-testid="button-discard-draft-for-group-modal"]').trigger('click');
    await flushPromises();

    expect(mocks.addDraft).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith('/next');
  });

  test('lets navigation continue when nothing has changed', async () => {
    mountModal({ hasDataChanged: false });

    expect(await mocks.leaveGuard!({ fullPath: '/next', name: 'transactions' })).toBe(true);
  });

  test('lets navigation continue when skipped or on login', async () => {
    mountModal({ skip: true });

    expect(await mocks.leaveGuard!({ fullPath: '/next', name: 'transactions' })).toBe(true);
    expect(await mocks.leaveGuard!({ fullPath: '/login', name: 'Login' })).toBe(true);
  });

  test('lets navigation continue when the same draft already exists', async () => {
    mocks.draftExists.mockResolvedValue(true);
    mountModal();

    expect(await mocks.leaveGuard!({ fullPath: '/next', name: 'transactions' })).toBe(true);
  });
});
