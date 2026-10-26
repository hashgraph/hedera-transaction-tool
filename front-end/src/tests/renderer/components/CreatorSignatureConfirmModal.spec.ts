// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import CreatorSignatureConfirmModal from '@renderer/components/CreatorSignatureConfirmModal.vue';
import { CREATOR_SIGNATURE_TEXT } from '@renderer/utils/creatorSignatureText';

const TESTID = 'modal-confirm-sign-unverified-creator';

const render = (props: Record<string, unknown>) =>
  mount(CreatorSignatureConfirmModal, {
    props: { show: true, 'onUpdate:show': () => {}, ...props } as never,
    global: { stubs: { AppModal: { template: '<div><slot /></div>' } } },
  });

describe('CreatorSignatureConfirmModal.vue', () => {
  test.each(['data-missing', 'unverifiable', 'creator-unavailable'] as const)(
    'shows the single-transaction warning for %s',
    status => {
      const wrapper = render({ status, callback: vi.fn() });
      expect(wrapper.text()).toContain(CREATOR_SIGNATURE_TEXT[status].confirm);
    },
  );

  test('shows the group warning when group is set', () => {
    const wrapper = render({ status: 'unverifiable', group: true, callback: vi.fn() });
    expect(wrapper.text()).toContain(CREATOR_SIGNATURE_TEXT.unverifiable.groupConfirm);
  });

  test('runs the callback only when the user chooses Sign Anyway', async () => {
    const callback = vi.fn();
    const wrapper = mount(
      {
        components: { CreatorSignatureConfirmModal },
        data: () => ({ show: true }),
        template:
          '<CreatorSignatureConfirmModal v-model:show="show" status="unverifiable" :callback="cb" />',
        methods: { cb: callback },
      },
      { global: { stubs: { AppModal: { template: '<div><slot /></div>' } } } },
    );

    await wrapper.get(`[data-testid="${TESTID}-confirm"]`).trigger('click');
    await flushPromises();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('does not run the callback when cancelled', async () => {
    const callback = vi.fn();
    const wrapper = mount(
      {
        components: { CreatorSignatureConfirmModal },
        data: () => ({ show: true }),
        template:
          '<CreatorSignatureConfirmModal v-model:show="show" status="unverifiable" :callback="cb" />',
        methods: { cb: callback },
      },
      { global: { stubs: { AppModal: { template: '<div><slot /></div>' } } } },
    );

    await wrapper.get(`[data-testid="${TESTID}-cancel"]`).trigger('click');
    await flushPromises();
    expect(callback).not.toHaveBeenCalled();
  });
});
