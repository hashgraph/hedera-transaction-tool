// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import ContractIdInput from '@renderer/components/Transaction/Create/ContractExecute/ContractIdInput.vue';

const AutoCompleteStub = defineComponent({
  name: 'AppAutoComplete',
  props: [
    'modelValue',
    'items',
    'sanitize',
    'findMatch',
    'filterItem',
    'itemLabel',
    'decorate',
    'dataTestid',
  ],
  emits: ['update:modelValue'],
  template: '<div />',
});

const items = [
  { value: '0.0.1001', nickname: 'Token Vault' },
  { value: '0x' + 'ab'.repeat(20), nickname: '' },
];

function mountInput(props: Record<string, unknown> = {}) {
  const wrapper = mount(ContractIdInput, {
    props: { modelValue: '', items, ...props },
    global: { stubs: { AppAutoComplete: AutoCompleteStub } },
  });
  return { wrapper, ac: wrapper.findComponent(AutoCompleteStub) };
}

describe('ContractIdInput.vue', () => {
  test('passes only the item values to the autocomplete', () => {
    const { ac } = mountInput({ modelValue: '0.0.5', dataTestid: 'x' });
    expect(ac.props('items')).toEqual(['0.0.1001', '0x' + 'ab'.repeat(20)]);
    expect(ac.props('modelValue')).toBe('0.0.5');
    expect(ac.props('dataTestid')).toBe('x');
  });

  test('re-emits update:modelValue from the autocomplete', () => {
    const { wrapper, ac } = mountInput();
    ac.vm.$emit('update:modelValue', '0.0.9');
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['0.0.9']);
  });

  test('sanitize trims leading whitespace only', () => {
    const { ac } = mountInput();
    expect(ac.props('sanitize')('  0.0.1 ')).toBe('0.0.1 ');
  });

  test('itemLabel returns nickname or empty string', () => {
    const { ac } = mountInput();
    expect(ac.props('itemLabel')('0.0.1001')).toBe('Token Vault');
    expect(ac.props('itemLabel')('0.0.9999')).toBe('');
    expect(ac.props('itemLabel')('0x' + 'ab'.repeat(20))).toBe('');
  });

  test('decorate shows nickname ghost text only for saved contracts with a nickname', () => {
    const { ac } = mountInput();
    expect(ac.props('decorate')('0.0.1001')).toBe('  Token Vault');
    expect(ac.props('decorate')('  0.0.1001 ')).toBe('  Token Vault');
    expect(ac.props('decorate')('0.0.42')).toBe('');
    expect(ac.props('decorate')('0x' + 'ab'.repeat(20))).toBe('');
  });

  test('filterItem matches by id or by nickname (case-insensitive)', () => {
    const { ac } = mountInput();
    const filter = ac.props('filterItem');
    expect(filter('0.0.1001', '0.0.10')).toBe(true);
    expect(filter('0.0.1001', 'vault')).toBe(true);
    expect(filter('0.0.1001', 'zzz')).toBe(false);
  });

  test('findMatch prefers id match, falls back to nickname with alignStart -1, else null', () => {
    const { ac } = mountInput();
    const findMatch = ac.props('findMatch');
    const values = ['0.0.1001', '0x' + 'ab'.repeat(20)];
    expect(findMatch(values, '0.0.10')).toEqual({ index: 0, alignStart: 0 });
    expect(findMatch(values, 'token')).toEqual({ index: 0, alignStart: -1 });
    expect(findMatch(values, 'nomatch')).toBeNull();
  });
});
