// @vitest-environment happy-dom
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { ContractId } from '@hiero-ledger/sdk';
import ContractIdInput from '@renderer/components/ContractIdInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';

describe('ContractIdInput.vue', () => {
  test('Full cycle', async () => {
    // 1) Mount
    let contractId: ContractId | null = null;
    let inputStatus = InputStatus.empty;
    const wrapper = mount(ContractIdInput, {
      props: {
        contractId,
        'onUpdate:contractId': async (v: ContractId | null) => {
          // https://test-utils.vuejs.org/guide/advanced/v-model.html
          await nextTick();
          await wrapper.setProps({ contractId: v });
          contractId = v;
        },
        'onInputStatus': (v: InputStatus) => {
          inputStatus = v;
        },
      },
      attachTo: document.body,
    });
    expect(contractId).toBe(null);
    expect(inputStatus).toBe(InputStatus.empty);

    // 2) User inputs 0.0.1 => inputStatus == valid, contractId == 0.0.1
    await wrapper.find('input').setValue('0.0.1');
    await flushPromises();
    expect(contractId!.toString()).toBe('0.0.1');
    expect(inputStatus).toBe(InputStatus.valid);

    // 2) User inputs 0.0.2 => inputStatus == valid, contractId == 0.0.2
    await wrapper.find('input').setValue('0.0.2');
    await flushPromises();
    expect(contractId!.toString()).toBe('0.0.2');
    expect(inputStatus).toBe(InputStatus.valid);

    // 3) User inputs invalid text => inputStatus == invalid, contractId == null
    await wrapper.find('input').setValue('abc');
    await flushPromises();
    expect(contractId).toBe(null);
    expect(inputStatus).toBe(InputStatus.invalid);

    // 4) User clears input => inputStatus == empty, contractId == null
    await wrapper.find('input').setValue('   ');
    await flushPromises();
    expect(contractId).toBe(null);
    expect(inputStatus).toBe(InputStatus.empty);
  }, 100_000);
});
