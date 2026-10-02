// @vitest-environment happy-dom
import { describe, test, expect, vi, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import AppTextArea from '@renderer/components/ui/AppTextArea.vue';

/* Helpers */
// happy-dom (like jsdom) never runs a real layout engine, so getComputedStyle() and
// scrollHeight don't reflect actual text wrapping. This stands in for "what the browser
// would report" for a textarea whose content needs `scrollHeight` worth of pixels at its
// current width, given the supplied font metrics.
type LayoutMock = {
  lineHeight: string;
  fontSize?: string;
  paddingTop?: string;
  paddingBottom?: string;
  scrollHeight: number;
};

function mockLayout(el: HTMLElement, layout: LayoutMock) {
  const { lineHeight, fontSize = '14px', paddingTop = '5px', paddingBottom = '5px', scrollHeight } = layout;
  const original = window.getComputedStyle.bind(window);

  vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudoElt) => {
    if (target === el) {
      return { lineHeight, fontSize, paddingTop, paddingBottom } as CSSStyleDeclaration;
    }
    return original(target, pseudoElt);
  });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppTextArea', () => {
  test('smoke: renders a textarea with the form-control class', () => {
    const wrapper = mount(AppTextArea);
    const textarea = wrapper.find('textarea');
    expect(textarea.exists()).toBe(true);
    expect(textarea.classes()).toContain('form-control');
  });

  test('defaults rows to 4 when autoExpand is off and no rows prop is given', () => {
    const wrapper = mount(AppTextArea);
    expect(wrapper.find('textarea').attributes('rows')).toBe('4');
  });

  test('filled prop adds the is-fill class', () => {
    const wrapper = mount(AppTextArea, { props: { filled: true } });
    expect(wrapper.find('textarea').classes()).toContain('is-fill');
  });

  test('without filled, is-fill is absent', () => {
    const wrapper = mount(AppTextArea);
    expect(wrapper.find('textarea').classes()).not.toContain('is-fill');
  });

  test('limit prop sets maxlength', () => {
    const wrapper = mount(AppTextArea, { props: { limit: 150 } });
    expect(wrapper.find('textarea').attributes('maxlength')).toBe('150');
  });

  test('omitting limit leaves maxlength unset', () => {
    const wrapper = mount(AppTextArea);
    expect(wrapper.find('textarea').attributes('maxlength')).toBeUndefined();
  });

  test('typing emits update:modelValue with the new value', async () => {
    const wrapper = mount(AppTextArea, { props: { modelValue: '' } });
    await wrapper.find('textarea').setValue('hello');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['hello']);
  });

  test('without autoExpand, rows never changes regardless of content height', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 2, autoExpand: false } });
    const el = wrapper.find('textarea').element;
    mockLayout(el, { lineHeight: '28px', scrollHeight: 200 });

    await wrapper.find('textarea').setValue('a very long line of text');
    expect(Number(el.rows)).toBe(2);
  });

  test('autoExpand: content that fits in 1 row stays at 1 row with no internal scroll', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true } });
    const el = wrapper.find('textarea').element;
    // 1 line of content: scrollHeight == 1 line (28px) + vertical padding (10px)
    mockLayout(el, { lineHeight: '28px', scrollHeight: 38 });

    await wrapper.find('textarea').setValue('short');
    expect(Number(el.rows)).toBe(1);
    expect(el.style.overflowY).toBe('');
  });

  test('autoExpand: grows to 2 rows when content needs a 2nd line', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true } });
    const el = wrapper.find('textarea').element;
    // 2 lines of content: scrollHeight == 2 * 28px + 10px padding
    mockLayout(el, { lineHeight: '28px', scrollHeight: 66 });

    await wrapper.find('textarea').setValue('line one\nline two');
    expect(Number(el.rows)).toBe(2);
    expect(el.style.overflowY).toBe('');
  });

  test('autoExpand: clamps at the default max of 3 rows and switches to scrolling', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true } });
    const el = wrapper.find('textarea').element;
    // Content that would need 5 lines worth of height
    mockLayout(el, { lineHeight: '28px', scrollHeight: 150 });

    await wrapper.find('textarea').setValue('a'.repeat(300));
    expect(Number(el.rows)).toBe(3);
    expect(el.style.overflowY).toBe('auto');
  });

  test('autoExpand: maxRows prop overrides the default clamp', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true, maxRows: 2 } });
    const el = wrapper.find('textarea').element;
    // Content that would need 5 lines worth of height
    mockLayout(el, { lineHeight: '28px', scrollHeight: 150 });

    await wrapper.find('textarea').setValue('a'.repeat(300));
    expect(Number(el.rows)).toBe(2);
    expect(el.style.overflowY).toBe('auto');
  });

  test('autoExpand: shrinks back down and clears the scrollbar once content fits again', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true } });
    const el = wrapper.find('textarea').element;
    const textarea = wrapper.find('textarea');

    mockLayout(el, { lineHeight: '28px', scrollHeight: 150 });
    await textarea.setValue('a'.repeat(300));
    expect(Number(el.rows)).toBe(3);
    expect(el.style.overflowY).toBe('auto');

    mockLayout(el, { lineHeight: '28px', scrollHeight: 38 });
    await textarea.setValue('');
    expect(Number(el.rows)).toBe(1);
    expect(el.style.overflowY).toBe('');
  });

  // Regression test: Bootstrap's `.form-control` sets `line-height: 1.5` as a bare
  // number. A unitless line-height's *computed* value is that number itself, not a
  // resolved length, so it must be multiplied by font-size — otherwise the row-count
  // math divides by ~1.5-2 instead of ~24-28px and overshoots almost immediately.
  test('autoExpand: resolves a unitless line-height against font-size', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true } });
    const el = wrapper.find('textarea').element;
    // line-height: 2 (unitless) * font-size: 14px = 28px/line.
    // 2 lines + 10px padding = 66px scrollHeight.
    mockLayout(el, { lineHeight: '2', fontSize: '14px', scrollHeight: 66 });

    await wrapper.find('textarea').setValue('line one\nline two');
    expect(Number(el.rows)).toBe(2);
  });

  test('autoExpand: an already-resolved px line-height is used as-is', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true } });
    const el = wrapper.find('textarea').element;
    mockLayout(el, { lineHeight: '28px', fontSize: '14px', scrollHeight: 66 });

    await wrapper.find('textarea').setValue('line one\nline two');
    expect(Number(el.rows)).toBe(2);
  });

  test('autoExpand: resizes on mount, before any input event', async () => {
    const wrapper = mount(AppTextArea, { props: { rows: 1, autoExpand: true } });
    const el = wrapper.find('textarea').element;
    mockLayout(el, { lineHeight: '28px', scrollHeight: 66 });

    await flushPromises();
    expect(Number(el.rows)).toBe(2);
  });
});
