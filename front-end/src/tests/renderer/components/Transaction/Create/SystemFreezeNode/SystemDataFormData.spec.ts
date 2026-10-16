// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import SystemDataFormData from '@renderer/components/Transaction/Create/SystemData/SystemDataFormData.vue';

const AppInput = {
  props: ['modelValue'],
  emits: ['update:modelValue', 'blur'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
};

const mountForm = (data = { fileId: '', contractId: '' }) =>
  mount(SystemDataFormData, { props: { data }, global: { stubs: { AppInput } } });

describe('SystemDataFormData.vue', () => {
  test('blurring the contract field formats contractId and leaves fileId alone', async () => {
    const w = mountForm({ fileId: '0.0.150', contractId: '1234' });
    await w.find('[data-testid="input-contract-id"]').trigger('blur');

    const [payload] = w.emitted('update:data')![0] as [{ fileId: string; contractId: string }];
    expect(payload.fileId).toBe('0.0.150');
    expect(payload.contractId).toBe('0.0.1234');
  });

  test('blurring the file field formats fileId and leaves contractId alone', async () => {
    const w = mountForm({ fileId: '150', contractId: '0.0.1234' });
    await w.find('[data-testid="input-file-id-for-update"]').trigger('blur');

    const [payload] = w.emitted('update:data')![0] as [{ fileId: string; contractId: string }];
    expect(payload.fileId).toBe('0.0.150');
    expect(payload.contractId).toBe('0.0.1234');
  });

  test('typing in each field only changes that field', async () => {
    const w = mountForm({ fileId: '0.0.150', contractId: '' });
    await w.find('[data-testid="input-contract-id"]').setValue('0.0.9');
    expect(w.emitted('update:data')![0][0]).toEqual({ fileId: '0.0.150', contractId: '0.0.9' });
  });
});
