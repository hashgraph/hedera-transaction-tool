// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import { TransactionStatus } from '@shared/interfaces';
import TransactionGroupDetails from '@renderer/pages/TransactionGroupDetails/TransactionGroupDetails.vue';
import {
  cancelTransactionGroup,
  getTransactionGroupById,
  getUserShouldApprove,
} from '@renderer/services/organization';


const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();

const userStore = {
  personal: { id: 'user-id' },
  selectedOrganization: {
    userId: 1,
    serverUrl: 'https://org.example.com',
    userKeys: [{ id: 77, publicKey: 'pub', mnemonicHash: 'hash' }],
  },
  publicKeys: [],
  keyPairs: [],
};

const contactsStore = {
  contacts: [
    {
      user: { id: 1 },
      userKeys: [{ id: 77 }],
    },
  ],
};

const notificationsStore = {
  currentOrganizationNotifications: [],
  markAsReadIds: vi.fn().mockResolvedValue(undefined),
};

const routeUpMock = vi.fn();
const routerMock = {
  currentRoute: {
    value: {
      params: {
        id: '10',
      },
    },
  },
  back: vi.fn(),
  push: vi.fn(),
};

const groupResponse = {
  id: 10,
  description: 'Cancel test group',
  atomic: false,
  sequential: false,
  createdAt: new Date().toISOString(),
  groupValidStart: new Date().toISOString(),
  groupItems: [
    {
      seq: 1,
      transactionId: 101,
      transaction: {
        id: 101,
        creatorKeyId: 77,
        transactionId: '0.0.101@12345.0001',
        transactionBytes: '0102',
        validStart: new Date().toISOString(),
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        statusCode: null,
        type: 'CRYPTO_TRANSFER',
      },
    },
  ],
};

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => routerMock),
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
    mirrorNodeBaseURL: 'https://mirror.example.com',
  })),
}));

vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: vi.fn(() => ({
    contextStack: [],
    routeUp: routeUpMock,
  })),
}));

vi.mock('@renderer/stores/storeContacts.ts', () => ({
  default: vi.fn(() => contactsStore),
}));

vi.mock('@renderer/stores/storeNotifications.ts', () => ({
  default: vi.fn(() => notificationsStore),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({
    getPassword: vi.fn(() => null),
    passwordModalOpened: vi.fn(() => false),
  })),
}));

vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));

vi.mock('@renderer/composables/useCreateTooltips', () => ({
  default: vi.fn(() => vi.fn()),
}));

vi.mock('@renderer/composables/useWebsocketSubscription', () => ({
  default: vi.fn(),
}));

vi.mock('@renderer/services/organization', () => ({
  cancelTransactionGroup: vi.fn(),
  getTransactionById: vi.fn(),
  getTransactionGroupById: vi.fn(),
  getUserShouldApprove: vi.fn(),
  sendApproverChoice: vi.fn(),
}));

vi.mock('@renderer/services/keyPairService', () => ({
  decryptPrivateKey: vi.fn(),
}));

vi.mock('@renderer/services/electronUtilsService.ts', () => ({
  saveFileToPath: vi.fn(),
  showSaveDialog: vi.fn(),
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
  assertUserLoggedIn: vi.fn(),
  getErrorMessage: vi.fn((error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback),
  getPrivateKey: vi.fn(),
  getStatusFromCode: vi.fn(),
  getTransactionBodySignatureWithoutNodeAccountId: vi.fn(),
  generateTransactionExportFileName: vi.fn(),
  generateTransactionV1ExportContent: vi.fn(),
  hexToUint8Array: vi.fn(() => new Uint8Array([1, 2])),
  isLoggedInOrganization: vi.fn(() => true),
  isUserLoggedIn: vi.fn(() => true),
  usersPublicRequiredToSign: vi.fn(async () => []),
  signTransactions: vi.fn(),
  isSignableTransaction: vi.fn(async () => false),
}));

vi.mock('@renderer/utils/sdk/transactions.ts', () => ({
  formatTransactionType: vi.fn(() => 'CRYPTO TRANSFER'),
  getTransactionTypeFromBackendType: vi.fn(() => 'CRYPTO TRANSFER'),
}));

vi.mock('@shared/utils/byteUtils', () => ({
  areByteArraysEqual: vi.fn(() => true),
}));

vi.mock('@hashgraph/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hashgraph/sdk')>();

  return {
    ...actual,
    Transaction: {
      ...actual.Transaction,
      fromBytes: vi.fn((bytes: Uint8Array) => ({
        toBytes: () => bytes,
      })),
    },
  };
});

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
  template: '<div data-testid="group-confirm-modal" />',
});

const mountGroupDetails = async () => {
  vi.mocked(getTransactionGroupById).mockResolvedValue(groupResponse as any);
  vi.mocked(getUserShouldApprove).mockResolvedValue(false);

  const wrapper = mount(TransactionGroupDetails, {
    global: {
      stubs: {
        AppButton: AppButtonStub,
        AppConfirmModal: AppConfirmModalStub,
        AppDropDown: true,
        AppLoader: true,
        EmptyTransactions: true,
        DateTimeString: true,
        NextTransactionCursor: true,
        BreadCrumb: true,
        TransactionId: true,
        TransactionGroupRow: true,
      },
    },
  });

  await flushPromises();

  return wrapper;
};

const confirmCancelAll = async (wrapper: ReturnType<typeof mount>) => {
  const form = wrapper.find('form');
  const cancelButton = wrapper.get('[data-testid="button-cancel-group"]');
  const submitEvent = new Event('submit', { cancelable: true });
  Object.defineProperty(submitEvent, 'submitter', { value: cancelButton.element });
  form.element.dispatchEvent(submitEvent);
  await flushPromises();

  const modal = wrapper.findComponent({ name: 'AppConfirmModal' });
  const callback = modal.props('callback') as (() => Promise<void>) | null;
  expect(typeof callback).toBe('function');
  await callback?.();
  await flushPromises();
};

describe('TransactionGroupDetails.vue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('uses one Cancel All API call and refreshes group state after a failed cancel attempt', async () => {
    vi.mocked(cancelTransactionGroup).mockRejectedValueOnce(new Error('cancel failed'));
    const wrapper = await mountGroupDetails();

    expect(getTransactionGroupById).toHaveBeenCalledTimes(1);

    await confirmCancelAll(wrapper);

    expect(cancelTransactionGroup).toHaveBeenCalledTimes(1);
    expect(cancelTransactionGroup).toHaveBeenCalledWith('https://org.example.com', 10);
    expect(getTransactionGroupById).toHaveBeenCalledTimes(2);
    expect(toastError).toHaveBeenCalled();
  });

  test('shows success toast when all transactions cancel successfully', async () => {
    vi.mocked(cancelTransactionGroup).mockResolvedValueOnce({
      canceled: [101],
      alreadyCanceled: [],
      failed: [],
      summary: {
        total: 1,
        canceled: 1,
        alreadyCanceled: 0,
        failed: 0,
      },
    } as any);

    const wrapper = await mountGroupDetails();
    await confirmCancelAll(wrapper);

    expect(cancelTransactionGroup).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith(
      '1 transaction(s) canceled successfully',
      { duration: 4000 },
    );
  });

  test('shows warning toast for partial group cancel outcomes', async () => {
    vi.mocked(cancelTransactionGroup).mockResolvedValueOnce({
      canceled: [101],
      alreadyCanceled: [202],
      failed: [
        {
          id: 303,
          code: 'CONFLICT',
          message: 'Transaction state changed during cancellation. Please retry.',
        },
      ],
      summary: {
        total: 3,
        canceled: 1,
        alreadyCanceled: 1,
        failed: 1,
      },
    } as any);

    const wrapper = await mountGroupDetails();
    await confirmCancelAll(wrapper);

    expect(toastWarning).toHaveBeenCalledWith(
      '1 canceled, 1 already canceled, 1 failed',
      { duration: 4000 },
    );
  });
});
