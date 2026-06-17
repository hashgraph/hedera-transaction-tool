// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import FileContentsModal from '@renderer/components/FileContentsModal.vue';

const mountModal = (contents: Uint8Array, fileId?: string | null) =>
  mount(FileContentsModal, {
    props: {
      show: true,
      'onUpdate:show': vi.fn(),
      contents,
      fileId,
    },
    global: {
      stubs: { AppModal: { template: '<div><slot /></div>' } },
    },
  });

describe('FileContentsModal.vue', () => {
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
});
