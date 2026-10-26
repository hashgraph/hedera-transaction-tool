// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@renderer/composables/useCreateTooltip', () => ({ default: vi.fn() }));

import CreatorSignaturePill from '@renderer/components/CreatorSignaturePill.vue';
import { CREATOR_SIGNATURE_TEXT } from '@renderer/utils/creatorSignatureText';

describe('CreatorSignaturePill.vue', () => {
  test('renders nothing when the signature is verified', () => {
    const wrapper = mount(CreatorSignaturePill, { props: { status: 'verified' } });
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  test.each([
    ['data-missing', 'bg-danger'],
    ['unverifiable', 'bg-warning'],
    ['creator-unavailable', 'bg-warning'],
  ] as const)('shows the %s label with %s styling', (status, cls) => {
    const wrapper = mount(CreatorSignaturePill, { props: { status } });
    const badge = wrapper.get('.badge');
    expect(badge.text()).toBe(CREATOR_SIGNATURE_TEXT[status].label);
    expect(badge.classes()).toContain(cls);
    expect(badge.attributes('data-bs-title')).toBe(CREATOR_SIGNATURE_TEXT[status].message);
  });

  test('uses the group tooltip text for groups', () => {
    const wrapper = mount(CreatorSignaturePill, { props: { status: 'unverifiable', group: true } });
    expect(wrapper.get('.badge').attributes('data-bs-title')).toBe(
      CREATOR_SIGNATURE_TEXT.unverifiable.groupMessage,
    );
  });
});
