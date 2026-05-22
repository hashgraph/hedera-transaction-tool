// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

const mocks = vi.hoisted(() => ({
  getStoredClaim: vi.fn(),
  setStoredClaim: vi.fn(),
  user: {
    personal: { id: 'user-1', isLoggedIn: true } as { id: string; isLoggedIn: boolean } | null,
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => mocks.user),
}));

vi.mock('@renderer/services/claimService', () => ({
  getStoredClaim: (...args: unknown[]) => mocks.getStoredClaim(...args),
  setStoredClaim: (...args: unknown[]) => mocks.setStoredClaim(...args),
}));

vi.mock('@shared/constants', () => ({
  DATE_TIME_PREFERENCE: 'date_time_preference',
}));

vi.mock('@renderer/utils', () => ({
  isUserLoggedIn: (personal: unknown) =>
    !!(personal && typeof personal === 'object' && (personal as { isLoggedIn?: boolean }).isLoggedIn),
  safeAwait: async <T,>(promise: Promise<T>) => {
    try {
      const data = await promise;
      return { data };
    } catch (error) {
      return { error };
    }
  },
}));

type ComposableReturn = Awaited<
  ReturnType<typeof import('@renderer/composables/user/useDateTimeSetting.ts')['default']>
>;

async function loadComposable(): Promise<{
  useDateTimeSetting: typeof import('@renderer/composables/user/useDateTimeSetting.ts')['default'];
  DateTimeOptions: typeof import('@renderer/composables/user/useDateTimeSetting.ts')['DateTimeOptions'];
}> {
  const mod = await import('@renderer/composables/user/useDateTimeSetting.ts');
  return { useDateTimeSetting: mod.default, DateTimeOptions: mod.DateTimeOptions };
}

function mountWithComposable(useDateTimeSetting: () => ComposableReturn) {
  let captured: ComposableReturn | null = null;
  const Comp = defineComponent({
    setup() {
      captured = useDateTimeSetting();
      return () => h('div');
    },
  });
  const wrapper = mount(Comp);
  return { wrapper, get composable() {
    if (!captured) throw new Error('composable not captured');
    return captured;
  }};
}

describe('useDateTimeSetting', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getStoredClaim.mockReset();
    mocks.setStoredClaim.mockReset();
    mocks.user.personal = { id: 'user-1', isLoggedIn: true };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('loads UTC default after onBeforeMount', async () => {
    mocks.getStoredClaim.mockResolvedValue(null);
    const { useDateTimeSetting } = await loadComposable();

    const { composable } = mountWithComposable(useDateTimeSetting);
    expect(composable.isUtcSelected.value).toBe(false);

    await flushPromises();
    expect(composable.isUtcSelected.value).toBe(true);
    expect(composable.dateTimeSettingLabel.value).toBe('UTC Time');
  });

  test('reads stored Local Time claim and reflects it in isUtcSelected', async () => {
    mocks.getStoredClaim.mockResolvedValue('local-time');
    const { useDateTimeSetting } = await loadComposable();

    const { composable } = mountWithComposable(useDateTimeSetting);
    await flushPromises();

    expect(composable.isUtcSelected.value).toBe(false);
    expect(composable.dateTimeSettingLabel.value).toBe('Local Time');
  });

  test('two consumers share the same loaded state (singleton)', async () => {
    mocks.getStoredClaim.mockResolvedValue(null);
    const { useDateTimeSetting } = await loadComposable();

    const first = mountWithComposable(useDateTimeSetting);
    const second = mountWithComposable(useDateTimeSetting);

    await flushPromises();

    expect(first.composable.isUtcSelected.value).toBe(true);
    expect(second.composable.isUtcSelected.value).toBe(true);
    // Same underlying ref instance — proves no per-consumer state copies
    expect(first.composable.isUtcSelected).toBe(second.composable.isUtcSelected);
  });

  test('setDateTimeSetting updates shared state reactively for all consumers without null flicker', async () => {
    mocks.getStoredClaim.mockResolvedValue(null);
    mocks.setStoredClaim.mockResolvedValue(undefined);
    const { useDateTimeSetting, DateTimeOptions } = await loadComposable();

    const first = mountWithComposable(useDateTimeSetting);
    const second = mountWithComposable(useDateTimeSetting);
    await flushPromises();

    expect(first.composable.isUtcSelected.value).toBe(true);
    expect(second.composable.isUtcSelected.value).toBe(true);

    await first.composable.setDateTimeSetting(DateTimeOptions.LOCAL_TIME);

    expect(second.composable.isUtcSelected.value).toBe(false);
    expect(second.composable.dateTimeSettingLabel.value).toBe('Local Time');
  });

  test('getDateTimeSetting returns the cached value without re-fetching once loaded', async () => {
    mocks.getStoredClaim.mockResolvedValue('local-time');
    const { useDateTimeSetting, DateTimeOptions } = await loadComposable();

    const { composable } = mountWithComposable(useDateTimeSetting);
    await flushPromises();
    expect(mocks.getStoredClaim).toHaveBeenCalledTimes(1);

    const result = await composable.getDateTimeSetting();
    expect(result).toBe(DateTimeOptions.LOCAL_TIME);
    expect(mocks.getStoredClaim).toHaveBeenCalledTimes(1);
  });

  test('falls back to UTC default when user is not logged in', async () => {
    mocks.user.personal = null;
    const { useDateTimeSetting, DateTimeOptions } = await loadComposable();

    const { composable } = mountWithComposable(useDateTimeSetting);
    await flushPromises();

    expect(mocks.getStoredClaim).not.toHaveBeenCalled();
    expect(composable.isUtcSelected.value).toBe(true);
    expect(await composable.getDateTimeSetting()).toBe(DateTimeOptions.UTC_TIME);
  });
});
