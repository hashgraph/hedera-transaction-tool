// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';

import { KeyPathWithName } from '@shared/interfaces';
import SelectKeys from '@renderer/pages/Migrate/components/SelectKeys.vue';

import { buttonStub } from './migrationStubs';

const keys = [
  new KeyPathWithName('testkey1', '/TransactionTools/Keys/testkey1.pem'),
  new KeyPathWithName('testkey2', '/TransactionTools/Keys/testkey2.pem'),
];

const EncryptedKeysBoxStub = {
  props: ['keys', 'fileNames', 'selectedKeys'],
  emits: ['update:selectedKeys'],
  template: '<div data-testid="keys-box" />',
};

const mountStep = () =>
  mount(SelectKeys, {
    props: { keysToRecover: keys },
    global: { stubs: { AppButton: buttonStub, EncryptedKeysBox: EncryptedKeysBoxStub } },
  });

const select = async (wrapper: ReturnType<typeof mountStep>, names: string[]) => {
  wrapper.getComponent(EncryptedKeysBoxStub).vm.$emit('update:selectedKeys', names);
  await wrapper.vm.$nextTick();
};

describe('Migrate: select keys step', () => {
  test('lists every encrypted key found in the TTv1 export by file name', () => {
    const box = mountStep().getComponent(EncryptedKeysBoxStub);

    expect(box.props('fileNames')).toEqual(['testkey1', 'testkey2']);
  });

  test('Continue is disabled until a key is selected', async () => {
    const wrapper = mountStep();
    const button = () => wrapper.get('[data-testid="button-migration-select-keys"]');

    expect(button().attributes('disabled')).toBeDefined();

    await select(wrapper, ['testkey1']);

    expect(button().attributes('disabled')).toBeUndefined();
  });

  test('Continue emits only the selected keys', async () => {
    const wrapper = mountStep();

    await select(wrapper, ['testkey2']);
    await wrapper.get('[data-testid="button-migration-select-keys"]').trigger('click');

    expect(wrapper.emitted('selected-keys')).toEqual([[[keys[1]]]]);
  });

  test('all keys can be selected', async () => {
    const wrapper = mountStep();

    await select(wrapper, ['testkey1', 'testkey2']);
    await wrapper.get('[data-testid="button-migration-select-keys"]').trigger('click');

    expect(wrapper.emitted('selected-keys')).toEqual([[keys]]);
  });

  test('Skip continues with no keys, even if some were selected', async () => {
    const wrapper = mountStep();

    await select(wrapper, ['testkey1']);
    await wrapper.get('[data-testid="button-migration-skip-keys"]').trigger('click');

    expect(wrapper.emitted('selected-keys')).toEqual([[[]]]);
  });

  test('Cancel stops the migration', async () => {
    const wrapper = mountStep();

    await wrapper.get('[data-testid="button-migration-cancel"]').trigger('click');

    expect(wrapper.emitted('migration:cancel')).toHaveLength(1);
    expect(wrapper.emitted('selected-keys')).toBeUndefined();
  });
});
