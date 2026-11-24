// @vitest-environment happy-dom
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { FileId } from '@hiero-ledger/sdk';
import FileIdInput from '@renderer/components/FileIdInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';
import { type InputReport } from '@renderer/components/InputReport.ts';

describe('FileIdInput.vue', () => {
  test('Full cycle', async () => {
    // 1) Mount
    let fileId: FileId | null = null;
    let inputReport: InputReport<FileId> = { status: InputStatus.empty, value: null };
    const wrapper = mount(FileIdInput, {
      props: {
        fileId,
        'onUpdate:fileId': async (v: FileId | null) => {
          // https://test-utils.vuejs.org/guide/advanced/v-model.html
          await nextTick();
          await wrapper.setProps({ fileId: v });
          fileId = v;
        },
        onInputReport: (v: InputReport<FileId>) => {
          inputReport = v;
        },
      },
      attachTo: document.body,
    });
    expect(fileId).toBe(null);
    expect(inputReport.status).toBe(InputStatus.empty);
    expect(inputReport.value).toBe(null);

    // 2) User inputs 0.0.1 => inputStatus == valid, fileId == 0.0.1
    await wrapper.find('input').setValue('0.0.1');
    await flushPromises();
    expect(fileId!.toString()).toBe('0.0.1');
    expect(inputReport.status).toBe(InputStatus.valid);
    expect(inputReport.value?.toString()).toBe('0.0.1');

    // 2) User inputs 0.0.2 => inputStatus == valid, fileId == 0.0.2
    await wrapper.find('input').setValue('0.0.2');
    await flushPromises();
    expect(fileId!.toString()).toBe('0.0.2');
    expect(inputReport.status).toBe(InputStatus.valid);
    expect(inputReport.value?.toString()).toBe('0.0.2');

    // 3) User inputs invalid date => inputStatus == invalid, fileId == 0.0.2
    await wrapper.find('input').setValue('abc');
    await flushPromises();
    expect(fileId).toBe(null);
    expect(inputReport.status).toBe(InputStatus.invalid);
    expect(inputReport.value).toBe(null);

    // 4) User clears input => inputStatus == empty, fileId == null
    await wrapper.find('input').setValue('   ');
    await flushPromises();
    expect(fileId).toBe(null);
    expect(inputReport.status).toBe(InputStatus.empty);
    expect(inputReport.value).toBe(null);
  }, 100_000);
});
