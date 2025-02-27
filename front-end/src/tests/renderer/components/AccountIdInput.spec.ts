import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';
import { createTestingPinia } from '@pinia/testing';


describe('AccountIdInput', () => {
  const wrapper = mount(AccountIdInput, {
    props: {
      modelValue: ''
    },
    global: {
      plugins: [createTestingPinia()],
    },
  })
  const input = wrapper.find('input');

  it('renders', () => {
    expect(input.element.value).toBe('')
  });

  it('allows input of numerical values and does not autofill a prefix', async () => {
    input.element.value = '1';

    const inputEvent = new Event('input', { bubbles: true, cancelable: true });

    input.element.dispatchEvent(inputEvent);

    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted();

    expect(emitted).toHaveProperty('update:modelValue');
    expect(emitted['update:modelValue'][0]);
    expect(emitted['update:modelValue'][0]).toEqual(['1']);

    if (emitted['update:modelValue'][0]) {
      wrapper.setProps({ modelValue: emitted['update:modelValue'][0][0] });
    }

    await wrapper.vm.$nextTick()

    expect(input.element.value).toBe('1')
  });
});
