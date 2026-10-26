// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { proto } from '@hiero-ledger/proto';
import { Long } from '@hiero-ledger/sdk';

import { decodeProto, hasHiddenData } from '@shared/hederaSpecialFiles';

import FileContentsModal from '@renderer/components/FileContentsModal.vue';

vi.mock('@renderer/services/electronUtilsService', () => ({
  exportFilesWithDialog: vi.fn().mockResolvedValue(undefined),
}));

import { exportFilesWithDialog } from '@renderer/services/electronUtilsService';

const mountModal = async (contents: Uint8Array, fileId?: string | null, transactionId?: string) => {
  const wrapper = mount(FileContentsModal, {
    props: {
      show: true,
      'onUpdate:show': vi.fn(),
      contents,
      fileId,
      transactionId,
    },
    global: {
      stubs: { AppModal: { template: '<div><slot /></div>' } },
    },
  });
  await flushPromises();
  return wrapper;
};

const decodeProtoMock = vi.fn();

describe('FileContentsModal.vue', () => {
  beforeEach(() => {
    vi.mocked(exportFilesWithDialog).mockClear();
    decodeProtoMock
      .mockReset()
      .mockImplementation(async (fileId, contents) => decodeProto(fileId, contents));
    (window as any).electronAPI = {
      local: {
        files: {
          decodeProto: decodeProtoMock,
          hasHiddenData: async (fileId: any, contents: any) =>
            hasHiddenData(fileId, contents),
        },
      },
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    vi.unstubAllGlobals();
  });

  it('shows (empty) for an empty Uint8Array', async () => {
    const wrapper = await mountModal(new Uint8Array(0));
    expect(wrapper.find('pre').text()).toBe('(empty)');
    expect(wrapper.text()).not.toContain('Binary content');
  });

  it('shows plain UTF-8 text content', async () => {
    const contents = new TextEncoder().encode('Hello, Hedera!');
    const wrapper = await mountModal(contents);
    expect(wrapper.find('pre').text()).toContain('Hello, Hedera!');
    expect(wrapper.text()).not.toContain('Binary content');
  });

  it('shows "Binary content — cannot display" for non-UTF-8 bytes', async () => {
    // 0xFF 0xFE are valid UTF-16 BOM bytes but invalid in strict UTF-8
    const contents = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
    const wrapper = await mountModal(contents);
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.text()).toContain('Binary content — cannot display');
  });

  it('shows "Binary content — cannot display" for content with non-printable bytes', async () => {
    // NULL byte embedded in otherwise valid UTF-8
    const contents = new TextEncoder().encode('hello\x00world');
    const wrapper = await mountModal(contents);
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.text()).toContain('Binary content — cannot display');
  });

  it('shows "Binary content — cannot display" when decodeProto throws for a special file ID', async () => {
    // Garbage bytes that are not a valid protobuf for 0.0.112 (ExchangeRateSet)
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02]);
    const wrapper = await mountModal(contents, '0.0.112');
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.text()).toContain('Binary content — cannot display');
  });

  it.each(['0.0.121', '0.0.122'])(
    'escapes hostile %s settings in the signer review',
    async fileId => {
      const contents = proto.ServicesConfigurationList.encode({
        nameValue: [
          {
            name: 'getAccountDetails\u202e\u200b',
            value: '2-50\r\ncryptoTransfer=2-55\b',
            data: Uint8Array.of(255),
          },
        ],
      }).finish();
      const wrapper = await mountModal(contents, fileId);
      const text = wrapper.find('pre').element.textContent;
      expect(text).toContain('2-50\\r\\ncryptoTransfer=2-55\\b');
      expect(text).toContain('getAccountDetails\\u202e\\u200b');
      expect(text).not.toMatch(/[\r\x08\u202e\u200b]/u);
      expect(JSON.parse(text).nameValue).toHaveLength(1);
      expect(JSON.parse(text).nameValue[0].data).toBe('/w==');
    },
  );

  it('displays decoded address-book JSON using Electron’s decoding API', async () => {
    const contents = proto.NodeAddressBook.encode({
      nodeAddress: [{ nodeId: Long.fromNumber(1) }],
    }).finish();
    const decoded = decodeProto('0.0.101', contents);
    decodeProtoMock.mockResolvedValueOnce(decoded);
    // The renderer has no Node Buffer global; decoding must run through Electron.
    vi.stubGlobal('Buffer', undefined);

    const wrapper = await mountModal(contents, '0.0.101');

    expect(decodeProtoMock).toHaveBeenCalledWith('0.0.101', contents);
    expect(wrapper.find('pre').text()).toBe(decoded);
    expect(wrapper.text()).toContain('Decoded');
    expect(wrapper.text()).not.toContain('Binary content');
  });

  it('shows the hidden data notice above the contents for noncanonical encodings', async () => {
    // Setting { name: "k", value: "x" }, with value encoded before name.
    const wrapper = await mountModal(Buffer.from('0a061201780a016b', 'hex'), '0.0.121');
    const notice = wrapper.find('[data-testid="file-contents-hidden-data-notice"]');
    expect(notice.text()).toContain('non-canonical encoding');
    expect(notice.text()).toContain('Download the original contents');
    const html = wrapper.html();
    expect(html.indexOf('file-contents-hidden-data-notice')).toBeLessThan(html.indexOf('<pre'));
    expect(wrapper.find('pre').text()).not.toContain('originalBytesHex');
  });

  it('shows no hidden data notice for canonical encodings', async () => {
    const wrapper = await mountModal(Buffer.from('0a060a016b120178', 'hex'), '0.0.121');
    expect(wrapper.find('[data-testid="file-contents-hidden-data-notice"]').exists()).toBe(false);
  });

  it('keeps newer contents when an earlier decode finishes late', async () => {
    let resolveFirst!: (value: string) => void;
    decodeProtoMock.mockImplementationOnce(
      () =>
        new Promise<string>(resolve => {
          resolveFirst = resolve;
        }),
    );
    const wrapper = await mountModal(Uint8Array.of(10, 0), '0.0.101');
    expect(wrapper.text()).toContain('Loading contents');
    expect(wrapper.text()).not.toContain('Binary content');

    decodeProtoMock.mockResolvedValueOnce('{"newer":true}');
    await wrapper.setProps({ contents: Uint8Array.of(10, 0, 10, 0) });
    await flushPromises();
    expect(wrapper.find('pre').text()).toBe('{"newer":true}');

    resolveFirst('{"stale":true}');
    await flushPromises();
    expect(wrapper.find('pre').text()).toBe('{"newer":true}');
  });

  it('renders a download link', async () => {
    const contents = new TextEncoder().encode('Hello');
    const wrapper = await mountModal(contents);
    expect(wrapper.find('button.btn-link').exists()).toBe(true);
    expect(wrapper.find('button.btn-link').text()).toContain('download original content');
  });

  it('opens a save dialog with a .txt extension for plain text content', async () => {
    const contents = new TextEncoder().encode('Hello');
    const wrapper = await mountModal(contents, null, '0.0.1234@1234567890.0');
    await wrapper.find('button').trigger('click');
    expect(exportFilesWithDialog).toHaveBeenCalledWith(
      [{ data: contents }],
      '0.0.1234@1234567890.0-file-contents.txt',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['txt'] })]),
      expect.any(String),
    );
  });

  it('opens a save dialog with a .bin extension for binary content', async () => {
    const contents = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
    const wrapper = await mountModal(contents, null, '0.0.1234@1234567890.0');
    await wrapper.find('button').trigger('click');
    expect(exportFilesWithDialog).toHaveBeenCalledWith(
      [{ data: contents }],
      '0.0.1234@1234567890.0-file-contents.bin',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['bin'] })]),
      expect.any(String),
    );
  });

  it('opens a save dialog with a .bin extension for special file IDs (raw protobuf bytes)', async () => {
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const wrapper = await mountModal(contents, '0.0.112');
    await wrapper.find('button').trigger('click');
    expect(exportFilesWithDialog).toHaveBeenCalledWith(
      [{ data: contents }],
      'file-contents.bin',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['bin'] })]),
      expect.any(String),
    );
  });

  it('opens a save dialog with a .bin extension for config special files (0.0.121)', async () => {
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const wrapper = await mountModal(contents, '0.0.121');
    await wrapper.find('button').trigger('click');
    expect(exportFilesWithDialog).toHaveBeenCalledWith(
      [{ data: contents }],
      'file-contents.bin',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['bin'] })]),
      expect.any(String),
    );
  });

  it('delegates file selection and writing to the main process', async () => {
    const contents = new TextEncoder().encode('Hello');
    const wrapper = await mountModal(contents);
    await wrapper.find('button').trigger('click');
    expect(exportFilesWithDialog).toHaveBeenCalledWith(
      [{ data: contents }],
      'file-contents.txt',
      'Save File',
      'Save',
      expect.any(Array),
      '',
    );
  });

  it('leaves cancellation handling to the main process', async () => {
    vi.mocked(exportFilesWithDialog).mockResolvedValueOnce(false);
    const contents = new TextEncoder().encode('Hello');
    const wrapper = await mountModal(contents);
    await wrapper.find('button').trigger('click');
    expect(exportFilesWithDialog).toHaveBeenCalledTimes(1);
  });

  it('does not show decoded notice for plain text content', async () => {
    const contents = new TextEncoder().encode('plain text');
    const wrapper = await mountModal(contents);
    expect(wrapper.text()).not.toContain('*Decoded');
  });

  it('does not show decoded notice when special file decode fails', async () => {
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02]);
    const wrapper = await mountModal(contents, '0.0.112');
    expect(wrapper.text()).not.toContain('*Decoded');
  });

  it('places the X icon and title in the correct structural order', async () => {
    const contents = new TextEncoder().encode('test');
    const wrapper = await mountModal(contents);
    const xIcon = wrapper.find('.bi-x-lg');
    const title = wrapper.find('h5');
    expect(xIcon.exists()).toBe(true);
    expect(title.exists()).toBe(true);
    // X icon's parent div should come before the h5 in the DOM
    const allElements = wrapper.findAll('div, h5');
    const xParentIndex = allElements.findIndex(el => el.find('.bi-x-lg').exists());
    const titleIndex = allElements.findIndex(el => el.element.tagName === 'H5');
    expect(xParentIndex).toBeLessThan(titleIndex);
  });
});
