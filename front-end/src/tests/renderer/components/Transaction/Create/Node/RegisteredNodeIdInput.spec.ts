// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import RegisteredNodeIdInput from '@renderer/components/Transaction/Create/Node/RegisteredNodeIdInput.vue';
import { registeredNodeIdStrategy } from '@renderer/components/Transaction/Create/Node/registeredNodeIdStrategy';

// This is a thin wrapper around the generic ChipMultiInput. Its job is to
// pin the strategy, the per-input cap, and the user-facing copy. The wrapper
// doesn't have its own logic to test — these checks just guard against an
// accidental copy/cap regression.
describe('RegisteredNodeIdInput (wrapper)', () => {
  test('mounts ChipMultiInput with the registered-node strategy and maxIds=20', () => {
    const wrapper = mount(RegisteredNodeIdInput, {
      props: { modelValue: [] },
    });
    const chip = wrapper.findComponent({ name: 'ChipMultiInput' });
    expect(chip.exists()).toBe(true);
    expect(chip.props('strategy')).toBe(registeredNodeIdStrategy);
    expect(chip.props('maxIds')).toBe(20);
    expect(chip.props('label')).toMatch(/associated registered nodes/i);
    expect(typeof chip.props('placeholder')).toBe('string');
  });

  test('forwards modelValue down', () => {
    const wrapper = mount(RegisteredNodeIdInput, {
      props: { modelValue: ['1', '5'] },
    });
    const chip = wrapper.findComponent({ name: 'ChipMultiInput' });
    expect(chip.props('modelValue')).toEqual(['1', '5']);
  });

  test('forwards ChipMultiInput\'s update:modelValue back up', async () => {
    const wrapper = mount(RegisteredNodeIdInput, {
      props: { modelValue: [] },
    });
    const chip = wrapper.findComponent({ name: 'ChipMultiInput' });
    chip.vm.$emit('update:modelValue', ['7', '8']);
    expect(wrapper.emitted('update:modelValue')).toEqual([[['7', '8']]]);
  });
});
