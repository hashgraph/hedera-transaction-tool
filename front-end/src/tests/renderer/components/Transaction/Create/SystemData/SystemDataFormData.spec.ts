// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import type { SystemData } from '@renderer/utils';
import SystemDataFormData from '@renderer/components/Transaction/Create/SystemData';
import FileIdInput from '@renderer/components/FileIdInput.vue';
import ContractIdInput from '@renderer/components/ContractIdInput.vue';
import { ContractId, FileId } from '@hiero-ledger/sdk';
import ButtonGroup from '@renderer/components/ui/ButtonGroup.vue';

describe('SystemDataFormData.vue', () => {
  test('Full Cycle', async () => {
    // 1) Mount
    const systemData: SystemData = {
      fileOrContractId: null,
    };
    const wrapper = mount(SystemDataFormData, {
      props: {
        data: systemData,
        'onUpdate:data': (newData: SystemData) => {
          Object.assign(systemData, newData);
        },
      },
      global: {
        directives: {
          'log-click': {},
        },
      },
    });
    expect(wrapper.findComponent(FileIdInput).exists()).toBe(true);
    expect(wrapper.findComponent(ContractIdInput).exists()).toBe(false);
    expect(systemData.fileOrContractId).toBe(null);

    // 2) User inputs file id 0.0.123
    await wrapper.findComponent(FileIdInput).find('input').setValue('0.0.123');
    expect(systemData.fileOrContractId instanceof FileId).toBe(true);
    expect(systemData.fileOrContractId?.toString()).toBe('0.0.123');

    // 3) User inputs invalid file id 0.0.123a
    await wrapper.findComponent(FileIdInput).find('input').setValue('0.0.123a');
    expect(systemData.fileOrContractId instanceof FileId).toBe(true);
    expect(systemData.fileOrContractId?.toString()).toBe('0.0.123');

    // 4) User inputs file 0.0.1234
    await wrapper.findComponent(FileIdInput).find('input').setValue('0.0.1234');
    expect(systemData.fileOrContractId instanceof FileId).toBe(true);
    expect(systemData.fileOrContractId?.toString()).toBe('0.0.1234');

    // 5) User toggle target to contract
    await wrapper
      .findComponent(ButtonGroup)
      .find('button[data-testid="tab-delete-target-contract"]')
      .trigger('click');
    expect(wrapper.findComponent(FileIdInput).exists()).toBe(false);
    expect(wrapper.findComponent(ContractIdInput).exists()).toBe(true);
    expect(systemData.fileOrContractId).toBe(null);

    // 2) User inputs contract id 0.0.789
    await wrapper.findComponent(ContractIdInput).find('input').setValue('0.0.789');
    expect(systemData.fileOrContractId instanceof ContractId).toBe(true);
    expect(systemData.fileOrContractId?.toString()).toBe('0.0.789');

    // 3) User inputs invalid contract id 0.0.789a
    await wrapper.findComponent(ContractIdInput).find('input').setValue('0.0.789a');
    expect(systemData.fileOrContractId instanceof ContractId).toBe(true);
    expect(systemData.fileOrContractId?.toString()).toBe('0.0.789');

    // 4) User inputs contract 0.0.789
    await wrapper.findComponent(ContractIdInput).find('input').setValue('0.0.7891');
    expect(systemData.fileOrContractId instanceof ContractId).toBe(true);
    expect(systemData.fileOrContractId?.toString()).toBe('0.0.7891');

    // 5) User toggle target to file back
    await wrapper
      .findComponent(ButtonGroup)
      .find('button[data-testid="tab-delete-target-file"]')
      .trigger('click');
    expect(wrapper.findComponent(FileIdInput).exists()).toBe(true);
    expect(wrapper.findComponent(ContractIdInput).exists()).toBe(false);
    expect(systemData.fileOrContractId).toBe(null);
  });
});
