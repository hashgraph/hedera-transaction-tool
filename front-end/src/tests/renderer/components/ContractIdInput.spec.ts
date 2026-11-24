// @vitest-environment happy-dom
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { ContractId } from '@hiero-ledger/sdk';
import ContractIdInput from '@renderer/components/ContractIdInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';
import { type InputReport } from '@renderer/components/InputReport.ts';

describe('ContractIdInput.vue', () => {
  test('Full cycle', async () => {
    // 1) Mount
    let contractId: ContractId | null = null;
    let inputReport: InputReport<ContractId> = { status: InputStatus.empty, value: null };
    const wrapper = mount(ContractIdInput, {
      props: {
        contractId,
        'onUpdate:contractId': async (v: ContractId | null) => {
          // https://test-utils.vuejs.org/guide/advanced/v-model.html
          await nextTick();
          await wrapper.setProps({ contractId: v });
          contractId = v;
        },
        'onInputReport': (v: InputReport<ContractId>) => {
          inputReport = v;
        },
      },
      attachTo: document.body,
    });
    expect(contractId).toBe(null);
    expect(inputReport.status).toBe(InputStatus.empty);
    expect(inputReport.value).toBe(null);

    // 2) User inputs 0.0.1 => inputStatus == valid, contractId == 0.0.1
    await wrapper.find('input').setValue('0.0.1');
    await flushPromises();
    expect(contractId!.toString()).toBe('0.0.1');
    expect(inputReport.status).toBe(InputStatus.valid);
    expect(inputReport.value?.toString()).toBe('0.0.1');

    // 2) User inputs 0.0.2 => inputStatus == valid, contractId == 0.0.2
    await wrapper.find('input').setValue('0.0.2');
    await flushPromises();
    expect(contractId!.toString()).toBe('0.0.2');
    expect(inputReport.status).toBe(InputStatus.valid);
    expect(inputReport.value?.toString()).toBe('0.0.2');

    // 3) User inputs invalid text => inputStatus == invalid, contractId == null
    await wrapper.find('input').setValue('abc');
    await flushPromises();
    expect(contractId).toBe(null);
    expect(inputReport.status).toBe(InputStatus.invalid);
    expect(inputReport.value).toBe(null);

    // 4) User clears input => inputStatus == empty, contractId == null
    await wrapper.find('input').setValue('   ');
    await flushPromises();
    expect(contractId).toBe(null);
    expect(inputReport.status).toBe(InputStatus.empty);
    expect(inputReport.value).toBe(null);
  }, 100_000);
});
