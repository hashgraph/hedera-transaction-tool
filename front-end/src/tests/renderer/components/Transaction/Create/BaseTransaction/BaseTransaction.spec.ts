// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

// Module-level route query the mocked `useRoute` reads. Each test sets this
// before mounting so getInitialValidStart() sees the desired param.
let mockRouteQuery: Record<string, string | undefined> = {};

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockRouteQuery }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ selectedOrganization: null }),
}));
vi.mock('@renderer/stores/storeKeys', () => ({
  default: () => ({ keyPairs: [] }),
}));
vi.mock('@renderer/stores/storeNetwork', () => ({
  default: () => ({ mirrorNodeBaseURL: 'http://localhost' }),
}));
vi.mock('@renderer/stores/storeNextTransactionV2.ts', () => ({
  default: () => ({}),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) },
}));

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => ({
    accountId: ref(''),
    isValid: ref(false),
    key: ref(undefined),
  }),
}));

vi.mock('@renderer/composables/useLoader', () => ({
  default: () => vi.fn(),
}));

vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: () => ({ computeSignatureKey: vi.fn(async () => ({ signatureKeys: [] })) }) },
}));

// Header/Id controls run binding expressions in BaseTransaction's render, so
// keep these label helpers cheap and deterministic.
vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionType: vi.fn(() => 'Transfer'),
}));
vi.mock('@renderer/utils/transactions', () => ({
  getPropagationButtonLabel: vi.fn(() => 'Sign'),
}));

// Stub the heavy children. We read TransactionIdControls' `validStart` prop to
// see what getInitialValidStart() seeded into the reactive data. Each factory
// is inlined because vi.mock is hoisted above any module-level helper.
vi.mock('@renderer/components/Transaction/TransactionHeaderControls.vue', () => ({
  default: { name: 'TransactionHeaderControls', props: ['validStart'], template: '<div></div>' },
}));
vi.mock('@renderer/components/Transaction/TransactionInfoControls.vue', () => ({
  default: { name: 'TransactionInfoControls', template: '<div></div>' },
}));
vi.mock('@renderer/components/Transaction/TransactionIdControls.vue', () => ({
  default: {
    name: 'TransactionIdControls',
    props: ['validStart', 'payerId', 'maxTransactionFee'],
    template: '<div></div>',
  },
}));
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseDraftLoad.vue', () => ({
  default: { name: 'BaseDraftLoad', template: '<div></div>' },
}));
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseGroupHandler.vue', () => ({
  default: { name: 'BaseGroupHandler', template: '<div></div>' },
}));
vi.mock(
  '@renderer/components/Transaction/Create/BaseTransaction/BaseApproversObserverData.vue',
  () => ({ default: { name: 'BaseApproversObserverData', template: '<div></div>' } }),
);
vi.mock('@renderer/components/Transaction/Create/BaseTransaction/BaseTransactionModal.vue', () => ({
  default: { name: 'BaseTransactionModal', template: '<div></div>' },
}));
vi.mock('@renderer/components/ui/AppInput.vue', () => ({
  default: { name: 'AppInput', template: '<div></div>' },
}));
vi.mock('@renderer/components/Transaction/TransactionProcessor', () => ({
  default: { name: 'TransactionProcessor', template: '<div></div>' },
  CustomRequest: class {},
  TransactionRequest: class {},
}));

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction/BaseTransaction.vue';

function mountBase() {
  return mount(BaseTransaction, {
    props: {
      // Minimal transaction stub: only toBytes/transactionId are touched during render.
      createTransaction: () => ({ toBytes: () => new Uint8Array(), transactionId: null }) as never,
    },
  });
}

function seededValidStart(wrapper: ReturnType<typeof mountBase>): Date {
  return wrapper.findComponent({ name: 'TransactionIdControls' }).props('validStart') as Date;
}

describe('BaseTransaction.vue – initial valid start', () => {
  beforeEach(() => {
    mockRouteQuery = {};
  });

  test('seeds validStart from the initialValidStart query param (epoch ms)', () => {
    mockRouteQuery = { initialValidStart: '1700000000000' };

    const validStart = seededValidStart(mountBase());

    expect(validStart.getTime()).toBe(1700000000000);
  });

  test('falls back to now when the param is absent', () => {
    const before = Date.now();

    const validStart = seededValidStart(mountBase());

    expect(validStart.getTime()).toBeGreaterThanOrEqual(before);
    expect(validStart.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('falls back to now when the param is not a number', () => {
    mockRouteQuery = { initialValidStart: 'not-a-number' };
    const before = Date.now();

    const validStart = seededValidStart(mountBase());

    expect(validStart.getTime()).toBeGreaterThanOrEqual(before);
    expect(validStart.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
