// @vitest-environment happy-dom
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { FileId } from '@hiero-ledger/sdk';
import FileIdInput from '@renderer/components/FileIdInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';

describe('FileIdInput.vue', () => {
  test('Full cycle', async () => {
    // 1) Mount
    let fileId: FileId | null = null;
    let inputStatus = InputStatus.empty;
    const wrapper = mount(FileIdInput, {
      props: {
        fileId,
        'onUpdate:fileId': async (v: FileId | null) => {
          // https://test-utils.vuejs.org/guide/advanced/v-model.html
          await nextTick();
          await wrapper.setProps({ fileId: v });
          fileId = v;
        },
        'onInputStatus': (v: InputStatus) => {
          inputStatus = v;
        },
      },
      attachTo: document.body,
    });
    expect(fileId).toBe(null);
    expect(inputStatus).toBe(InputStatus.empty);

    // 2) User inputs 0.0.1 => inputStatus == valid, fileId == 0.0.1
    await wrapper.find('input').setValue('0.0.1');
    await flushPromises();
    expect(fileId!.toString()).toBe('0.0.1');
    expect(inputStatus).toBe(InputStatus.valid);

    // 2) User inputs 0.0.2 => inputStatus == valid, fileId == 0.0.2
    await wrapper.find('input').setValue('0.0.2');
    await flushPromises();
    expect(fileId!.toString()).toBe('0.0.2');
    expect(inputStatus).toBe(InputStatus.valid);

    // 3) User inputs invalid date => inputStatus == invalid, fileId == 0.0.2
    await wrapper.find('input').setValue('abc');
    await flushPromises();
    expect(fileId).toBe(null);
    expect(inputStatus).toBe(InputStatus.invalid);

    // 4) User clears input => inputStatus == empty, fileId == null
    await wrapper.find('input').setValue('   ');
    await flushPromises();
    expect(fileId).toBe(null);
    expect(inputStatus).toBe(InputStatus.empty);
  }, 100_000);
});
