// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

import FileContentsModal from '@renderer/components/FileContentsModal.vue';

vi.mock('@renderer/services/electronUtilsService', () => ({
  showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/test.json' }),
  saveFileToPath: vi.fn().mockResolvedValue(undefined),
}));

import { showSaveDialog, saveFileToPath } from '@renderer/services/electronUtilsService';

const mountModal = (contents: Uint8Array, fileId?: string | null, transactionId?: string) =>
  mount(FileContentsModal, {
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

describe('FileContentsModal.vue', () => {
  beforeEach(() => {
    vi.mocked(showSaveDialog).mockClear();
    vi.mocked(saveFileToPath).mockClear();
  });

  it('shows (empty) for an empty Uint8Array', () => {
    const wrapper = mountModal(new Uint8Array(0));
    expect(wrapper.find('pre').text()).toBe('(empty)');
    expect(wrapper.text()).not.toContain('Binary content');
  });

  it('shows plain UTF-8 text content', () => {
    const contents = new TextEncoder().encode('Hello, Hedera!');
    const wrapper = mountModal(contents);
    expect(wrapper.find('pre').text()).toContain('Hello, Hedera!');
    expect(wrapper.text()).not.toContain('Binary content');
  });

  it('shows "Binary content — cannot display" for non-UTF-8 bytes', () => {
    // 0xFF 0xFE are valid UTF-16 BOM bytes but invalid in strict UTF-8
    const contents = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
    const wrapper = mountModal(contents);
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.text()).toContain('Binary content — cannot display');
  });

  it('shows "Binary content — cannot display" for content with non-printable bytes', () => {
    // NULL byte embedded in otherwise valid UTF-8
    const contents = new TextEncoder().encode('hello\x00world');
    const wrapper = mountModal(contents);
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.text()).toContain('Binary content — cannot display');
  });

  it('shows "Binary content — cannot display" when decodeProto throws for a special file ID', () => {
    // Garbage bytes that are not a valid protobuf for 0.0.112 (ExchangeRateSet)
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02]);
    const wrapper = mountModal(contents, '0.0.112');
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.text()).toContain('Binary content — cannot display');
  });

  it('renders a download link', () => {
    const contents = new TextEncoder().encode('Hello');
    const wrapper = mountModal(contents);
    expect(wrapper.find('button.btn-link').exists()).toBe(true);
    expect(wrapper.find('button.btn-link').text()).toContain('download original content');
  });

  it('opens a save dialog with a .txt extension for plain text content', async () => {
    const contents = new TextEncoder().encode('Hello');
    const wrapper = mountModal(contents, null, '0.0.1234@1234567890.0');
    await wrapper.find('button').trigger('click');
    expect(showSaveDialog).toHaveBeenCalledWith(
      '0.0.1234@1234567890.0-file-contents.txt',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['txt'] })]),
      expect.any(String),
    );
  });

  it('opens a save dialog with a .bin extension for binary content', async () => {
    const contents = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
    const wrapper = mountModal(contents, null, '0.0.1234@1234567890.0');
    await wrapper.find('button').trigger('click');
    expect(showSaveDialog).toHaveBeenCalledWith(
      '0.0.1234@1234567890.0-file-contents.bin',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['bin'] })]),
      expect.any(String),
    );
  });

  it('opens a save dialog with a .bin extension for special file IDs (raw protobuf bytes)', async () => {
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const wrapper = mountModal(contents, '0.0.112');
    await wrapper.find('button').trigger('click');
    expect(showSaveDialog).toHaveBeenCalledWith(
      'file-contents.bin',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['bin'] })]),
      expect.any(String),
    );
  });

  it('opens a save dialog with a .bin extension for config special files (0.0.121)', async () => {
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const wrapper = mountModal(contents, '0.0.121');
    await wrapper.find('button').trigger('click');
    expect(showSaveDialog).toHaveBeenCalledWith(
      'file-contents.bin',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ extensions: ['bin'] })]),
      expect.any(String),
    );
  });

  it('saves the file to the chosen path after dialog confirm', async () => {
    const contents = new TextEncoder().encode('Hello');
    const wrapper = mountModal(contents);
    await wrapper.find('button').trigger('click');
    expect(saveFileToPath).toHaveBeenCalledWith(contents, '/tmp/test.json');
  });

  it('does not save when save dialog is cancelled', async () => {
    vi.mocked(showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: undefined });
    const contents = new TextEncoder().encode('Hello');
    const wrapper = mountModal(contents);
    await wrapper.find('button').trigger('click');
    expect(saveFileToPath).not.toHaveBeenCalled();
  });

  it('does not show decoded notice for plain text content', () => {
    const contents = new TextEncoder().encode('plain text');
    const wrapper = mountModal(contents);
    expect(wrapper.text()).not.toContain('*Decoded');
  });

  it('does not show decoded notice when special file decode fails', () => {
    const contents = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02]);
    const wrapper = mountModal(contents, '0.0.112');
    expect(wrapper.text()).not.toContain('*Decoded');
  });

  it('places the X icon and title in the correct structural order', () => {
    const contents = new TextEncoder().encode('test');
    const wrapper = mountModal(contents);
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
