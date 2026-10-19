// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Hbar } from '@hiero-ledger/sdk';

import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';

function mountInput(modelValue = new Hbar(0)) {
  const wrapper = mount(AppHbarInput, {
    props: {
      modelValue,
      'onUpdate:modelValue': (value: Hbar) => wrapper.setProps({ modelValue: value }),
    },
    attachTo: document.body,
  });
  return wrapper;
}

const amount = (wrapper: ReturnType<typeof mountInput>) =>
  (wrapper.props('modelValue') as Hbar).toBigNumber().toString();
const inputEl = (wrapper: ReturnType<typeof mountInput>) =>
  wrapper.find('input').element as HTMLInputElement;

describe('AppHbarInput.vue', () => {
  test('shows 0 initially', () => {
    expect(inputEl(mountInput())).toHaveProperty('value', '0');
  });

  test.each([
    ['', '0'],
    ['.', '0'],
    ['.5', '0.5'],
    ['5.', '5'],
    ['007', '7'],
  ])('on blur, %j is shown as %j', async (typed, shown) => {
    const wrapper = mountInput();
    const input = wrapper.find('input');

    await input.setValue(typed);
    await input.trigger('blur');

    expect(inputEl(wrapper).value).toBe(shown);
  });

  test('a cleared input is 0', async () => {
    const wrapper = mountInput(new Hbar(5));

    await wrapper.find('input').setValue('');

    expect(amount(wrapper)).toBe('0');
  });

  test.each([
    ['abc', '0'],
    ['1a2', '12'],
    ['1.2.3', '1.23'],
    ['-5', '5'],
    ['1,5', '15'],
  ])('pasted %j is sanitized to %j', async (pasted, expected) => {
    const wrapper = mountInput();

    await wrapper.find('input').setValue(pasted);
    await wrapper.find('input').trigger('blur');

    expect(amount(wrapper)).toBe(expected);
    expect(inputEl(wrapper).value).toBe(expected);
  });
});
