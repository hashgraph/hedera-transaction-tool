// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import {
  AccountId,
  FileCreateTransaction,
  FileUpdateTransaction,
  FileAppendTransaction,
  Transaction,
  TransactionId,
} from '@hiero-ledger/sdk';
import {
  getFileCreateTransactionData,
  getFileUpdateTransactionData,
  getFileAppendTransactionData,
} from '@renderer/utils/sdk/getData';
import { transactionCase } from '../../../../_utils_/transactionCase';

import FileContentFormData from '@renderer/components/Transaction/Create/FileData/FileContentFormData.vue';

const DECODED_PROTO_JSON = '{"nodeAddress":[]}';

vi.mock('@renderer/components/ui/AppUploadFile.vue', () => ({
  default: {
    name: 'AppUploadFile',
    props: ['id', 'file', 'maxSizeKb', 'showName', 'showProgress', 'accept', 'disabled'],
    emits: ['update:file'],
    template: '<div />',
  },
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: () => ({ error: vi.fn() }) },
}));

function makeFile(name: string, bytes: Uint8Array): { meta: File; content: Uint8Array; loadPercentage: number } {
  return { meta: new File([Buffer.from(bytes)], name), content: bytes, loadPercentage: 100 };
}

const BIN_BYTES = new Uint8Array([0x0a, 0x00]);
const TXT_BYTES = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);

describe('FileContentFormData', () => {
  let decodeProtoMock: ReturnType<typeof vi.fn>;
  let noticeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    decodeProtoMock = vi.fn().mockResolvedValue(DECODED_PROTO_JSON);
    noticeMock = vi.fn().mockResolvedValue(false);
    (window as any).electronAPI = {
      local: { files: { decodeProto: decodeProtoMock, hasHiddenData: noticeMock } },
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    vi.clearAllMocks();
  });

  describe('persisted contents props', () => {
    test.each([
      transactionCase('create', FileCreateTransaction, getFileCreateTransactionData),
      transactionCase('update', FileUpdateTransaction, getFileUpdateTransactionData),
      transactionCase('append', FileAppendTransaction, getFileAppendTransactionData),
    ] as const)(
      'restores serialized %s text drafts in editable mode',
      async (_name, TransactionClass, getData) => {
        const contents = 'hello\nHedera café 🌍';
        const transaction = new TransactionClass()
          .setContents(contents)
          .setTransactionId(TransactionId.generate('0.0.1234'))
          .setNodeAccountIds([AccountId.fromString('0.0.3')])
          .freeze();
        const restored = getData(Transaction.fromBytes(transaction.toBytes()));
        const wrapper = mount(FileContentFormData, {
          props: { fileId: '0.0.12345', contents: restored.contents },
        });
        await flushPromises();

        const textarea = wrapper.get<HTMLTextAreaElement>('[data-testid="textarea-file-content"]');
        expect(textarea.element.disabled).toBe(false);
        expect(textarea.element.value).toBe(contents);
        expect(wrapper.find('[data-testid="textarea-file-read-content"]').exists()).toBe(false);
        expect(wrapper.emitted('update:contents')).toBeUndefined();

        await textarea.setValue('edited contents');
        expect(wrapper.emitted('update:contents')?.at(-1)).toEqual(['edited contents']);
      },
    );

    describe.each([
      ['valid JSON', '{\n  "nodeAddress": [{"nodeId": "1", "nodeAccountId": "0.0.3"}]\n}'],
      ['incomplete JSON', '{\n  "nodeAddress": ['],
      ['plain text', 'work in progress'],
    ])('%s', (_description, contents) => {
      test.each([
        transactionCase('update', FileUpdateTransaction, getFileUpdateTransactionData),
        transactionCase('append', FileAppendTransaction, getFileAppendTransactionData),
      ] as const)('restores editable special-file text in a serialized %s draft', async (_name, TransactionClass, getData) => {
        const transaction = new TransactionClass()
          .setFileId('0.0.101')
          .setContents(contents)
          .setTransactionId(TransactionId.generate('0.0.1234'))
          .setNodeAccountIds([AccountId.fromString('0.0.3')])
          .freeze();
        const restored = getData(Transaction.fromBytes(transaction.toBytes()));
        const wrapper = mount(FileContentFormData, { props: { fileId: '', contents: '' } });
        // Draft data arrives after the initially empty form has mounted.
        await wrapper.setProps({ fileId: restored.fileId, contents: restored.contents });
        await flushPromises();

        const textarea = wrapper.get<HTMLTextAreaElement>('[data-testid="textarea-file-content"]');
        expect(textarea.element.disabled).toBe(false);
        expect(textarea.element.value).toBe(contents);
        expect(wrapper.find('[data-testid="textarea-file-read-content"]').exists()).toBe(false);
        expect(decodeProtoMock).not.toHaveBeenCalled();
        expect(new TextEncoder().encode(restored.contents as string)).toEqual(new TextEncoder().encode(contents));

        const edited = '{"nodeAddress": []}';
        await textarea.setValue(edited);
        expect(wrapper.emitted('update:contents')?.at(-1)).toEqual([edited]);
      });

    });

    test('displays existing string file content loaded from a pre-existing draft', async () => {
      const draftContents = 'persisted text contents from draft';

      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.12345', contents: draftContents },
      });

      await flushPromises();

      const manualTextarea = wrapper.find<HTMLTextAreaElement>(
        '[data-testid="textarea-file-content"]',
      );

      expect(wrapper.find('[data-testid="textarea-file-read-content"]').exists()).toBe(false);
      expect(manualTextarea.exists()).toBe(true);
      expect(manualTextarea.element.value).toBe(draftContents);
    });

    test('decodes restored Uint8Array contents from a special-file draft', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.101', contents: BIN_BYTES },
      });

      await flushPromises();

      expect(decodeProtoMock).toHaveBeenCalledWith('0.0.101', BIN_BYTES);
      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe(DECODED_PROTO_JSON);
      expect(wrapper.emitted('update:contents')).toBeUndefined();
    });

    test('does not emit restored Uint8Array contents from props', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.12345', contents: TXT_BYTES },
      });

      await flushPromises();

      expect(wrapper.emitted('update:contents')).toBeUndefined();
      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe('hello');
    });

    test('clears displayed content when persisted contents are null', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.12345', contents: 'persisted text contents' },
      });

      await flushPromises();

      expect(
        wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-content"]').element.value,
      ).toBe('persisted text contents');

      await wrapper.setProps({ contents: null });
      await flushPromises();

      expect(wrapper.find('[data-testid="textarea-file-read-content"]').exists()).toBe(false);
      expect(
        wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-content"]').element.value,
      ).toBe('');
    });
  });

  describe('hidden data notice', () => {
    const uploadBin = async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.101', contents: null },
      });
      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('addressBook.bin', BIN_BYTES));
      await flushPromises();
      return wrapper;
    };

    test('shows the notice below the textarea when the contents are not canonical', async () => {
      noticeMock.mockResolvedValue(true);
      const wrapper = await uploadBin();

      expect(noticeMock).toHaveBeenCalledWith('0.0.101', BIN_BYTES);
      const notice = wrapper.find('[data-testid="file-contents-hidden-data-notice"]');
      expect(notice.text()).toContain('not shown in the decoded view');
      expect(notice.text()).not.toContain('Download');
      const html = wrapper.html();
      expect(html.indexOf('textarea-file-read-content')).toBeLessThan(
        html.indexOf('file-contents-hidden-data-notice'),
      );
    });

    test('shows no notice for canonical contents', async () => {
      const wrapper = await uploadBin();
      expect(wrapper.find('[data-testid="file-contents-hidden-data-notice"]').exists()).toBe(false);
    });

    test('does not check non-special files', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.12345', contents: null },
      });
      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('test.txt', TXT_BYTES));
      await flushPromises();
      expect(noticeMock).not.toHaveBeenCalled();
    });
  });

  describe('Order 1: set fileId first, then upload file', () => {
    test('special fileId + .bin file → protobuf decoded content displayed', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.101', contents: null },
      });

      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('addressBook.bin', BIN_BYTES));
      await flushPromises();

      expect(decodeProtoMock).toHaveBeenCalledWith('0.0.101', BIN_BYTES);
      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe(
        DECODED_PROTO_JSON,
      );
    });

    test('non-special fileId + text file → UTF-8 decoded content displayed', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.12345', contents: null },
      });

      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('test.txt', TXT_BYTES));
      await flushPromises();

      expect(decodeProtoMock).not.toHaveBeenCalled();
      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe(
        new TextDecoder().decode(TXT_BYTES),
      );
    });
  });

  describe('Order 2: upload file first, then set fileId', () => {
    test('special fileId + .bin file → protobuf decoded content displayed (acceptance test 1 & 2)', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '', contents: null },
      });

      // Upload the .bin file BEFORE setting fileId
      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('addressBook.bin', BIN_BYTES));
      await flushPromises();

      // Initially decoded as UTF-8 (garbled) since no fileId yet
      expect(decodeProtoMock).not.toHaveBeenCalled();

      // Now set the special fileId — this should trigger a re-decode without re-upload
      await wrapper.setProps({ fileId: '0.0.101' });
      await flushPromises();

      expect(decodeProtoMock).toHaveBeenCalledWith('0.0.101', BIN_BYTES);
      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe(
        DECODED_PROTO_JSON,
      );
    });

    test('non-special fileId + text file → UTF-8 decoded content displayed', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '', contents: null },
      });

      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('test.txt', TXT_BYTES));
      await flushPromises();

      await wrapper.setProps({ fileId: '0.0.12345' });
      await flushPromises();

      expect(decodeProtoMock).not.toHaveBeenCalled();
      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe(
        new TextDecoder().decode(TXT_BYTES),
      );
    });
  });

  describe('Both orderings produce identical output (acceptance test 3)', () => {
    test('special fileId + .bin file produces same output regardless of order', async () => {
      // Order 1: set fileId first
      const wrapper1 = mount(FileContentFormData, {
        props: { fileId: '0.0.101', contents: null },
      });
      const appUpload1 = wrapper1.findComponent({ name: 'AppUploadFile' });
      await appUpload1.vm.$emit('update:file', makeFile('addressBook.bin', BIN_BYTES));
      await flushPromises();
      const output1 = wrapper1.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value;

      // Order 2: upload file first
      const wrapper2 = mount(FileContentFormData, {
        props: { fileId: '', contents: null },
      });
      const appUpload2 = wrapper2.findComponent({ name: 'AppUploadFile' });
      await appUpload2.vm.$emit('update:file', makeFile('addressBook.bin', BIN_BYTES));
      await flushPromises();
      await wrapper2.setProps({ fileId: '0.0.101' });
      await flushPromises();
      const output2 = wrapper2.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value;

      expect(output1).toBe(DECODED_PROTO_JSON);
      expect(output2).toBe(DECODED_PROTO_JSON);
      expect(output1).toBe(output2);
    });

    test('non-special fileId + text file produces same output regardless of order', async () => {
      const expectedText = new TextDecoder().decode(TXT_BYTES);

      const wrapper1 = mount(FileContentFormData, {
        props: { fileId: '0.0.12345', contents: null },
      });
      const appUpload1 = wrapper1.findComponent({ name: 'AppUploadFile' });
      await appUpload1.vm.$emit('update:file', makeFile('test.txt', TXT_BYTES));
      await flushPromises();
      const output1 = wrapper1.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value;

      const wrapper2 = mount(FileContentFormData, {
        props: { fileId: '', contents: null },
      });
      const appUpload2 = wrapper2.findComponent({ name: 'AppUploadFile' });
      await appUpload2.vm.$emit('update:file', makeFile('test.txt', TXT_BYTES));
      await flushPromises();
      await wrapper2.setProps({ fileId: '0.0.12345' });
      await flushPromises();
      const output2 = wrapper2.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value;

      expect(output1).toBe(expectedText);
      expect(output2).toBe(expectedText);
      expect(output1).toBe(output2);
    });
  });

  describe('edge cases', () => {
    test('changing fileId from special to non-special re-decodes as UTF-8', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.101', contents: null },
      });
      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('addressBook.bin', BIN_BYTES));
      await flushPromises();
      expect(decodeProtoMock).toHaveBeenCalledTimes(1);

      await wrapper.setProps({ fileId: '0.0.12345' });
      await flushPromises();

      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe(
        new TextDecoder().decode(BIN_BYTES),
      );
    });

    test('file with empty content does not trigger decode', async () => {
      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.101', contents: null },
      });
      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });

      // Emit file with empty content (loading state)
      await appUpload.vm.$emit('update:file', {
        meta: new File([], 'addressBook.bin'),
        content: new Uint8Array(),
        loadPercentage: 0,
      });
      await flushPromises();

      expect(decodeProtoMock).not.toHaveBeenCalled();
    });

    test('stale async decode is discarded when fileId changes during IPC call', async () => {
      let resolveFirst!: (v: string) => void;
      const firstCall = new Promise<string>(res => { resolveFirst = res; });
      let callCount = 0;
      decodeProtoMock.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return firstCall;
        return Promise.resolve('{"second":true}');
      });

      const wrapper = mount(FileContentFormData, {
        props: { fileId: '0.0.101', contents: null },
      });
      const appUpload = wrapper.findComponent({ name: 'AppUploadFile' });
      await appUpload.vm.$emit('update:file', makeFile('addressBook.bin', BIN_BYTES));
      await flushPromises();

      // Change fileId to another special file while first IPC call is still pending
      await wrapper.setProps({ fileId: '0.0.102' });
      await flushPromises();

      // Now resolve the stale first IPC call
      resolveFirst('{"stale":true}');
      await flushPromises();

      // Should show the result of the second (latest) call, not the stale first one
      expect(wrapper.find<HTMLTextAreaElement>('[data-testid="textarea-file-read-content"]').element.value).toBe(
        '{"second":true}',
      );
    });
  });
});
