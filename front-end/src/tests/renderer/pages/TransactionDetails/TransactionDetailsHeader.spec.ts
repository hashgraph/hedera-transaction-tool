// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import { TransactionStatus } from '@shared/interfaces';
import TransactionDetailsHeader from '@renderer/pages/TransactionDetails/components/TransactionDetailsHeader.vue';
import { cancelTransaction, executeTransaction } from '@renderer/services/organization';
import { showSaveDialog } from '@renderer/services/electronUtilsService';
import { Transaction as SDKTransaction } from '@hashgraph/sdk';

const routeUpMock = vi.fn();
const routeToNextMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();

const userStore = {
  personal: { id: 'user-id' },
  selectedOrganization: {
    userId: 1,
    serverUrl: 'https://org.example.com',
    userKeys: [],
  },
  publicKeys: [],
};

const contactsStore = {
  contacts: [
    {
      user: { id: 1 },
      userKeys: [{ id: 77 }],
    },
  ],
};

vi.mock('@hashgraph/sdk', () => {
  class Transaction {
    static fromBytes = vi.fn(() => new Transaction());
  }
  return { Transaction };
});

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    back: vi.fn(),
    push: vi.fn(),
  })),
}));

vi.mock('vue-toast-notification', () => ({
  useToast: vi.fn(() => ({
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
  })),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => userStore),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({
    network: 'testnet',
    mirrorNodeBaseURL: 'https://mirror.example.com',
  })),
}));

vi.mock('@renderer/stores/storeContacts', () => ({
  default: vi.fn(() => contactsStore),
}));

vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: vi.fn(() => ({
    contextStack: [],
    routeUp: routeUpMock,
    routeToNext: routeToNextMock,
    hasNext: false,
  })),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({
    getPassword: vi.fn(() => null),
    getPasswordAsync: vi.fn(() => Promise.resolve(null)),
    passwordModalOpened: vi.fn(() => false),
  })),
}));

vi.mock('@renderer/services/organization', () => ({
  archiveTransaction: vi.fn(),
  cancelTransaction: vi.fn(),
  executeTransaction: vi.fn(),
  getUserShouldApprove: vi.fn(),
  remindSigners: vi.fn(),
  sendApproverChoice: vi.fn(),
}));

vi.mock('@renderer/services/keyPairService', () => ({
  decryptPrivateKey: vi.fn(),
}));

vi.mock('@renderer/services/electronUtilsService', () => ({
  saveFileToPath: vi.fn(),
  showSaveDialog: vi.fn(),
}));

vi.mock('@renderer/services/transactionFileService.ts', () => ({
  writeTransactionFile: vi.fn(),
}));

vi.mock('@renderer/utils/sdk/transactions.ts', () => ({
  getTransactionType: vi.fn(),
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  assertUserLoggedIn: vi.fn(),
  generateTransactionExportFileName: vi.fn(),
  generateTransactionV1ExportContent: vi.fn(),
  generateTransactionV2ExportContent: vi.fn(),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  ),
  getLastExportExtension: vi.fn(),
  getPrivateKey: vi.fn(),
  getTransactionBodySignatureWithoutNodeAccountId: vi.fn(),
  hexToUint8Array: vi.fn(),
  isLoggedInOrganization: vi.fn(() => true),
  setLastExportExtension: vi.fn(),
  signTransactions: vi.fn(),
  usersPublicRequiredToSign: vi.fn(),
}));

vi.mock('@renderer/caches/mirrorNode/AccountByIdCache.ts', () => ({
  AccountByIdCache: {
    inject: vi.fn(() => ({})),
  },
}));

vi.mock('@renderer/caches/mirrorNode/NodeByIdCache.ts', () => ({
  NodeByIdCache: {
    inject: vi.fn(() => ({})),
  },
}));

vi.mock('@renderer/caches/backend/PublicKeyOwnerCache.ts', () => ({
  PublicKeyOwnerCache: {
    inject: vi.fn(() => ({})),
  },
}));

const AppButtonStub = defineComponent({
  name: 'AppButton',
  props: {
    type: {
      type: String,
      default: 'button',
    },
  },
  emits: ['click'],
  template: '<button v-bind="$attrs" :type="type" @click="$emit(\'click\')"><slot /></button>',
});

const AppConfirmModalStub = defineComponent({
  name: 'AppConfirmModal',
  props: {
    show: Boolean,
    callback: Function,
    text: String,
    title: String,
  },
  template: '<div data-testid="confirm-modal" />',
});

const defaultTransaction = {
  id: 101,
  creatorKeyId: 77,
  status: TransactionStatus.NEW,
  isManual: false,
} as any;

const mountHeader = (
  overrides?: Partial<any>,
  onAction?: ReturnType<typeof vi.fn>,
  sdkTransaction?: SDKTransaction,
) => {
  return mount(TransactionDetailsHeader, {
    props: {
      organizationTransaction: { ...defaultTransaction, ...overrides },
      localTransaction: null,
      sdkTransaction: sdkTransaction ?? null,
      onAction: onAction ?? vi.fn().mockResolvedValue(undefined),
    },
    global: {
      stubs: {
        AppButton: AppButtonStub,
        AppConfirmModal: AppConfirmModalStub,
        AppDropDown: true,
        NextTransactionCursor: true,
        SplitSignButtonDropdown: true,
        BreadCrumb: true,
      },
    },
  });
};

describe('TransactionDetailsHeader.vue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('hides action buttons that are invalid for canceled transactions', async () => {
    const wrapper = mountHeader({ status: TransactionStatus.CANCELED });
    await flushPromises();

    expect(wrapper.find('[data-testid="button-export-transaction"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="button-cancel-org-transaction"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-sign-org-transaction"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-approve-org-transaction"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="button-reject-org-transaction"]').exists()).toBe(false);
  });

  test('shows success toast after successful cancel', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const wrapper = mountHeader(undefined, onAction);

    vi.mocked(cancelTransaction).mockResolvedValueOnce(undefined as any);

    const form = wrapper.find('form');
    const cancelButton = wrapper.get('[data-testid="button-cancel-org-transaction"]');
    const submitEvent = new Event('submit', { cancelable: true });
    Object.defineProperty(submitEvent, 'submitter', { value: cancelButton.element });
    form.element.dispatchEvent(submitEvent);
    await flushPromises();

    const cancelController = wrapper.findComponent({ name: 'CancelTransactionController' });
    const modal = cancelController.findComponent({ name: 'AppConfirmModal' });
    const callback = modal.props('callback') as (() => Promise<void>) | null;
    expect(typeof callback).toBe('function');

    await callback?.();
    await flushPromises();

    expect(cancelTransaction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Transaction canceled successfully', {
      duration: 4000,
    });
  });

  test('refreshes transaction state after a failed cancel attempt', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const wrapper = mountHeader(undefined, onAction);

    vi.mocked(cancelTransaction).mockRejectedValueOnce(new Error('Cancel failed'));

    const form = wrapper.find('form');
    const cancelButton = wrapper.get('[data-testid="button-cancel-org-transaction"]');
    const submitEvent = new Event('submit', { cancelable: true });
    Object.defineProperty(submitEvent, 'submitter', { value: cancelButton.element });
    form.element.dispatchEvent(submitEvent);
    await flushPromises();

    const cancelController = wrapper.findComponent({ name: 'CancelTransactionController' });
    const modal = cancelController.findComponent({ name: 'AppConfirmModal' });
    const callback = modal.props('callback') as (() => Promise<void>) | null;
    expect(typeof callback).toBe('function');

    await callback?.();
    await flushPromises();

    expect(cancelTransaction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalled();
  });

  test('shows success toast after successful schedule', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const wrapper = mountHeader(
      { status: TransactionStatus.WAITING_FOR_EXECUTION, isManual: true },
      onAction,
    );

    const form = wrapper.find('form');
    const scheduleButton = wrapper.get('[data-testid="button-schedule-org-transaction"]');
    const submitEvent = new Event('submit', { cancelable: true });
    Object.defineProperty(submitEvent, 'submitter', { value: scheduleButton.element });
    form.element.dispatchEvent(submitEvent);
    await flushPromises();

    const scheduleController = wrapper.findComponent({ name: 'ScheduleTransactionController' });
    const modal = scheduleController.findComponent({ name: 'AppConfirmModal' });
    const callback = modal.props('callback') as (() => Promise<void>) | null;
    expect(typeof callback).toBe('function');

    await callback?.();
    await flushPromises();

    expect(executeTransaction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Transaction scheduled successfully', {
      duration: 4000,
    });
  });

  test('shows error toast after failed schedule', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const wrapper = mountHeader(
      { status: TransactionStatus.WAITING_FOR_EXECUTION, isManual: true },
      onAction,
    );

    vi.mocked(executeTransaction).mockRejectedValueOnce(new Error('Schedule failed'));

    const form = wrapper.find('form');
    const scheduleButton = wrapper.get('[data-testid="button-schedule-org-transaction"]');
    const submitEvent = new Event('submit', { cancelable: true });
    Object.defineProperty(submitEvent, 'submitter', { value: scheduleButton.element });
    form.element.dispatchEvent(submitEvent);
    await flushPromises();

    const scheduleController = wrapper.findComponent({ name: 'ScheduleTransactionController' });
    const modal = scheduleController.findComponent({ name: 'AppConfirmModal' });
    const callback = modal.props('callback') as (() => Promise<void>) | null;
    expect(typeof callback).toBe('function');

    await callback?.();
    await flushPromises();

    expect(executeTransaction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalled();
  });

  test('shows error toast when export is triggered without an SDK transaction', async () => {
    const wrapper = mountHeader({ status: TransactionStatus.CANCELED });
    await flushPromises();

    const form = wrapper.find('form');
    const exportButton = wrapper.get('[data-testid="button-export-transaction"]');
    const submitEvent = new Event('submit', { cancelable: true });
    Object.defineProperty(submitEvent, 'submitter', { value: exportButton.element });
    form.element.dispatchEvent(submitEvent);
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith(
      'Unable to export: transaction is not available',
      expect.objectContaining({ duration: 0 }),
    );
  });

  test('shows success toast after successful export to tx2 format', async () => {
    vi.mocked(showSaveDialog).mockResolvedValueOnce({
      filePath: '/tmp/export.tx2',
      canceled: false,
    } as any);

    const wrapper = mountHeader(
      { status: TransactionStatus.CANCELED },
      vi.fn().mockResolvedValue(undefined),
      new SDKTransaction(),
    );
    await flushPromises();

    const form = wrapper.find('form');
    const exportButton = wrapper.get('[data-testid="button-export-transaction"]');
    const submitEvent = new Event('submit', { cancelable: true });
    Object.defineProperty(submitEvent, 'submitter', { value: exportButton.element });
    form.element.dispatchEvent(submitEvent);
    await flushPromises();

    expect(showSaveDialog).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Transaction exported successfully', {
      duration: 4000,
    });
  });
});
