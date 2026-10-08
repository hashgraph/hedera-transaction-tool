// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';

import PendingRuleDeleteButton from '@renderer/components/ReviewerGroups/PendingRuleDeleteButton.vue';

describe('PendingRuleDeleteButton.vue', () => {
  test('renders a disabled delete button wrapped in a hover tooltip trigger', () => {
    const wrapper = mount(PendingRuleDeleteButton);

    expect(wrapper.attributes('data-bs-toggle')).toBe('tooltip');
    expect(wrapper.attributes('data-bs-trigger')).toBe('hover');
    expect(wrapper.attributes('data-bs-title')).toBe('Delete Pending');

    const button = wrapper.find('button');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.find('.bi-trash').exists()).toBe(true);
  });

  test('forwards attributes such as data-testid to the root element', () => {
    const wrapper = mount(PendingRuleDeleteButton, {
      attrs: { 'data-testid': 'button-pending-reviewer-rule-5' },
    });

    expect(wrapper.attributes('data-testid')).toBe('button-pending-reviewer-rule-5');
  });
});
