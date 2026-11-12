// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import RoleModal from '@renderer/pages/SmartContracts/components/RoleModal.vue';
import type { ContractRole } from '@renderer/utils/sdk/contractRoles';

const AppModalStub = {
  props: ['show'],
  emits: ['update:show'],
  template:
    '<div data-testid="modal"><button data-testid="modal-dismiss" @click="$emit(\'update:show\', false)" /><slot v-if="show" /></div>',
};
const AppButtonStub = {
  props: ['disabled'],
  template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
};

const role: ContractRole = {
  id: 'r1',
  name: 'MINTER_ROLE',
  verified: true,
  value: '0x' + '11'.repeat(32),
  note: 'mints',
};

function mountModal(props: { show?: boolean; role?: ContractRole | null } = {}) {
  return mount(RoleModal, {
    props: { show: true, role: null, ...props },
    global: {
      stubs: { AppModal: AppModalStub, AppButton: AppButtonStub },
    },
  });
}

const fill = async (wrapper: ReturnType<typeof mountModal>, testid: string, v: string) =>
  wrapper.find(`[data-testid="${testid}"]`).setValue(v);

const submit = async (wrapper: ReturnType<typeof mountModal>) => {
  await wrapper.find('form').trigger('submit');
  await flushPromises();
};

describe('RoleModal.vue', () => {
  test('add mode: shows Add role title, empty fields, save disabled until a name is entered', async () => {
    const wrapper = mountModal();

    expect(wrapper.find('h1').text()).toBe('Add role');
    expect((wrapper.find('[data-testid="input-role-name"]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('[data-testid="button-save-role"]').attributes('disabled')).toBeDefined();

    await fill(wrapper, 'input-role-name', 'ADMIN');
    expect(wrapper.find('[data-testid="button-save-role"]').attributes('disabled')).toBeUndefined();
  });

  test('saving with a name only emits a new verified=false role and closes the modal', async () => {
    const wrapper = mountModal();
    await fill(wrapper, 'input-role-name', '  AUDITOR  ');
    await submit(wrapper);

    const [savedRole] = wrapper.emitted('save')![0] as [ContractRole];
    expect(savedRole).toMatchObject({ name: 'AUDITOR', verified: false, note: undefined });
    expect(savedRole.id).toBeTruthy();
    expect(wrapper.emitted('update:show')![0]).toEqual([false]);
  });

  test('saving with a name and note trims the note', async () => {
    const wrapper = mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-note', '  who mints ');
    await submit(wrapper);

    const [savedRole] = wrapper.emitted('save')![0] as [ContractRole];
    expect(savedRole).toMatchObject({ name: 'MINTER', note: 'who mints' });
  });

  test('does nothing when the name is blank', async () => {
    const wrapper = mountModal();
    await fill(wrapper, 'input-role-name', '   ');
    await submit(wrapper);
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  test('edit mode: prefills the name and note and keeps role identity on save', async () => {
    const wrapper = mountModal({ role });

    expect(wrapper.find('h1').text()).toBe('Edit role');
    expect((wrapper.find('[data-testid="input-role-name"]').element as HTMLInputElement).value).toBe('MINTER_ROLE');
    expect((wrapper.find('[data-testid="input-role-note"]').element as HTMLInputElement).value).toBe('mints');

    await fill(wrapper, 'input-role-note', '');
    await submit(wrapper);

    const [savedRole] = wrapper.emitted('save')![0] as [ContractRole];
    expect(savedRole).toMatchObject({
      id: 'r1',
      verified: true,
      value: role.value,
      name: 'MINTER_ROLE',
      note: undefined,
    });
  });

  test('reopening the modal resets the form from the role; hiding does not touch it', async () => {
    const wrapper = mountModal({ show: false, role });
    await wrapper.setProps({ show: true, role: null });
    await fill(wrapper, 'input-role-name', 'typed');
    await wrapper.setProps({ show: false });
    await wrapper.setProps({ show: true });
    expect((wrapper.find('[data-testid="input-role-name"]').element as HTMLInputElement).value).toBe('');
  });

  test('cancel, close icon and modal dismiss all request closing', async () => {
    const wrapper = mountModal();
    await wrapper.find('i.bi-x-lg').trigger('click');
    await wrapper.findAll('button').find(b => b.text() === 'Cancel')!.trigger('click');
    await wrapper.find('[data-testid="modal-dismiss"]').trigger('click');

    expect(wrapper.emitted('update:show')).toEqual([[false], [false], [false]]);
    expect(wrapper.emitted('save')).toBeUndefined();
  });
});
