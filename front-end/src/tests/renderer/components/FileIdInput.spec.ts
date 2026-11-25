// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { FileId } from '@hiero-ledger/sdk';
import FileIdInput from '@renderer/components/FileIdInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';
import { type InputReport } from '@renderer/components/InputReport.ts';

describe('FileIdInput.vue', () => {
  test('Full cycle', async () => {
    // 1) Mount
    let inputReport: InputReport<FileId> = { status: InputStatus.empty, value: null };
    const wrapper = mount(FileIdInput, {
      props: {
        initialValue: null,
        onInputReport: (v: InputReport<FileId>) => {
          inputReport = v;
        },
      },
      attachTo: document.body,
    });
    expect(inputReport.status).toBe(InputStatus.empty);
    expect(inputReport.value).toBe(null);

    // 2) User inputs 0.0.1 => inputStatus == valid, fileId == 0.0.1
    await wrapper.find('input').setValue('0.0.1');
    await flushPromises();
    expect(inputReport.status).toBe(InputStatus.valid);
    expect(inputReport.value?.toString()).toBe('0.0.1');

    // 2) User inputs 0.0.2 => inputStatus == valid, fileId == 0.0.2
    await wrapper.find('input').setValue('0.0.2');
    await flushPromises();
    expect(inputReport.status).toBe(InputStatus.valid);
    expect(inputReport.value?.toString()).toBe('0.0.2');

    // 3) User inputs invalid date => inputStatus == invalid, fileId == 0.0.2
    await wrapper.find('input').setValue('abc');
    await flushPromises();
    expect(inputReport.status).toBe(InputStatus.invalid);
    expect(inputReport.value).toBe(null);

    // 4) User clears input => inputStatus == empty, fileId == null
    await wrapper.find('input').setValue('   ');
    await flushPromises();
    expect(inputReport.status).toBe(InputStatus.empty);
    expect(inputReport.value).toBe(null);

    // 5) Parent changes initialValue to 0.0.42 => inputStatus == valid, fileId == 0.0.42
    await wrapper.setProps({ initialValue: FileId.fromString('0.0.42') })
    await flushPromises();
    expect(inputReport.status).toBe(InputStatus.valid);
    expect(inputReport.value?.toString()).toBe('0.0.42');
  }, 100_000);
});
