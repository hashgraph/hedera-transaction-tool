// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

import ChipMultiInput, {
  type ChipMultiInputStrategy,
} from '@renderer/components/ui/ChipMultiInput.vue';

// A minimal strategy for testing: pass-through string IDs, no sanitize, parse
// is comma-separated, format is comma-separated. We override individual hooks
// per test when we want to assert behavior specific to one.
function makeStrategy(
  overrides: Partial<ChipMultiInputStrategy<string>> = {},
): ChipMultiInputStrategy<string> {
  return {
    sanitize: vi.fn((raw: string) => raw),
    parse: vi.fn((raw: string) => ({
      ids: raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    })),
    format: vi.fn((ids: string[]) => ids.join(', ')),
    display: vi.fn((id: string) => id),
    ...overrides,
  };
}

function mountInput(props: Partial<{
  modelValue: string[];
  strategy: ChipMultiInputStrategy<string>;
  maxIds: number;
  label: string;
  placeholder: string;
}> = {}) {
  // ChipMultiInput is a generic component (`<script setup generic="T">`); when
  // mounted through `@vue/test-utils`, TS can't infer T through the runtime
  // mount() API and falls back to `unknown`, which then mismatches our
  // `ChipMultiInputStrategy<string>` (the interface is invariant in T). Cast
  // the component reference to silence the inference; the runtime contract
  // still holds and is exercised by every assertion below.
   
  return mount(ChipMultiInput as any, {
    props: {
      modelValue: [] as string[],
      strategy: makeStrategy(),
      ...props,
    },
  });
}

describe('ChipMultiInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders label and placeholder when provided', () => {
    const wrapper = mountInput({
      label: 'My Label',
      placeholder: 'type here',
    });
    expect(wrapper.text()).toContain('My Label');
    expect(wrapper.find('input').attributes('placeholder')).toBe('type here');
  });

  test('label is programmatically associated with the input via matching for/id', () => {
    const wrapper = mountInput({ label: 'My Label' });
    const inputId = wrapper.find('input').attributes('id');
    expect(inputId).toBeTruthy();
    expect(wrapper.find('label').attributes('for')).toBe(inputId);
  });

  test('renders a chip per modelValue item using strategy.display', () => {
    const strategy = makeStrategy({ display: vi.fn(id => `#${id}`) });
    const wrapper = mountInput({ modelValue: ['1', '2', '3'], strategy });
    const chips = wrapper.findAll('.chip');
    expect(chips).toHaveLength(3);
    expect(chips[0].text()).toContain('#1');
    expect(chips[2].text()).toContain('#3');
  });

  test('seeds the input text from strategy.format on initial render', () => {
    const wrapper = mountInput({ modelValue: ['1', '2'] });
    const input = wrapper.find('input').element as HTMLInputElement;
    expect(input.value).toBe('1, 2');
  });

  test('input event runs strategy.sanitize and writes the cleaned value back', async () => {
    const strategy = makeStrategy({ sanitize: vi.fn(() => '1,2') });
    const wrapper = mountInput({ strategy });
    const input = wrapper.find('input');
    await input.setValue('garbage');
    expect(strategy.sanitize).toHaveBeenCalledWith('garbage');
    expect((input.element as HTMLInputElement).value).toBe('1,2');
  });

  test('Enter commits: parses the raw text and emits update:modelValue', async () => {
    const wrapper = mountInput();
    const input = wrapper.find('input');
    await input.setValue('1, 2, 3');
    await input.trigger('keydown', { key: 'Enter' });
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toHaveLength(1);
    expect(emitted![0][0]).toEqual(['1', '2', '3']);
  });

  test('blur commits the raw text', async () => {
    const wrapper = mountInput();
    const input = wrapper.find('input');
    await input.setValue('4, 5');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual(['4', '5']);
  });

  test('blur on empty input clears a previously non-empty modelValue', async () => {
    const wrapper = mountInput({ modelValue: ['1', '2'] });
    const input = wrapper.find('input');
    await input.setValue('');
    await input.trigger('blur');
    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toEqual([]);
  });

  test('blur on empty input with empty modelValue does not emit', async () => {
    const wrapper = mountInput({ modelValue: [] });
    const input = wrapper.find('input');
    await input.trigger('blur');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  test('whitespace-only blur normalizes the displayed input back to empty', async () => {
    // The strategy may legitimately allow whitespace in the input; on blur
    // the trimmed value is empty so we treat it as cleared. The visible
    // text must also be normalized to empty so the user doesn't see
    // lingering spaces after blur. (Pre-fix this only worked when the
    // watcher fired — i.e. when modelValue actually changed.)
    const wrapper = mountInput({
      modelValue: [],
      // Override sanitize to allow spaces to reach the input as-is.
      strategy: makeStrategy({ sanitize: vi.fn(raw => raw) }),
    });
    const input = wrapper.find('input');
    await input.setValue('   ');
    await input.trigger('blur');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  test('parser error is displayed and update:modelValue is not emitted', async () => {
    const strategy = makeStrategy({
      parse: vi.fn(() => ({ error: 'bad input' })),
    });
    const wrapper = mountInput({ strategy });
    const input = wrapper.find('input');
    await input.setValue('whatever');
    await input.trigger('blur');
    expect(wrapper.text()).toContain('bad input');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  test('exceeding maxIds shows error and does not emit', async () => {
    const wrapper = mountInput({ maxIds: 2 });
    const input = wrapper.find('input');
    await input.setValue('1, 2, 3');
    await input.trigger('blur');
    expect(wrapper.text()).toMatch(/Too many IDs/i);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  test('counter shows N / maxIds and turns red at the cap', async () => {
    const wrapper = mountInput({ modelValue: ['1', '2'], maxIds: 2 });
    expect(wrapper.text()).toContain('2 / 2');
    const counter = wrapper.findAll('p').find(p => p.text().includes('2 / 2'));
    expect(counter?.classes()).toContain('text-danger');
  });

  test('removing a chip emits the new list without that id', async () => {
    const wrapper = mountInput({ modelValue: ['1', '2', '3'] });
    const removes = wrapper.findAll('.chip-remove');
    await removes[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[['1', '3']]]);
  });

  test('removing a chip rewrites the input via strategy.format', async () => {
    const strategy = makeStrategy({
      format: vi.fn((ids: string[]) => ids.join('|')),
    });
    const wrapper = mountInput({ modelValue: ['1', '2'], strategy });
    const input = wrapper.find('input').element as HTMLInputElement;
    expect(input.value).toBe('1|2');
    await wrapper.findAll('.chip-remove')[0].trigger('click');
    expect(input.value).toBe('2');
  });

  test('chip-remove is a real <button> with an aria-label that names the id', () => {
    const wrapper = mountInput({ modelValue: ['1', '2'] });
    const remove = wrapper.findAll('.chip-remove')[0];
    expect(remove.element.tagName.toLowerCase()).toBe('button');
    expect(remove.attributes('type')).toBe('button');
    expect(remove.attributes('aria-label')).toBe('Remove 1');
    // The decorative × glyph must be hidden from AT so the announced name
    // is just the aria-label ("Remove 1") and not "X Remove 1" or similar.
    const glyph = remove.find('span');
    expect(glyph.exists()).toBe(true);
    expect(glyph.attributes('aria-hidden')).toBe('true');
  });

  test('async parent update does NOT overwrite the input while focused', async () => {
    const wrapper = mountInput({ modelValue: [] });
    const input = wrapper.find('input');
    // Simulate the user focusing and typing partway through a value.
    await input.trigger('focus');
    await input.setValue('1, 2');
    // Now the parent updates modelValue out from under us (e.g., a draft
    // loaded asynchronously after the user already started editing).
    await wrapper.setProps({ modelValue: ['5', '6', '7'] });
    // The input must still show what the user typed, not the parent's value.
    expect((input.element as HTMLInputElement).value).toBe('1, 2');
  });

  test('parent update is applied when the input is not focused', async () => {
    const wrapper = mountInput({ modelValue: ['1'] });
    const input = wrapper.find('input').element as HTMLInputElement;
    expect(input.value).toBe('1');
    await wrapper.setProps({ modelValue: ['5', '6', '7'] });
    expect(input.value).toBe('5, 6, 7');
  });

  test('commit normalizes the input via strategy.format on successful parse', async () => {
    const strategy = makeStrategy({
      format: vi.fn((ids: string[]) => ids.join('-')),
    });
    const wrapper = mountInput({ strategy });
    const input = wrapper.find('input');
    await input.setValue('1, 2, 3');
    await input.trigger('keydown', { key: 'Enter' });
    expect((input.element as HTMLInputElement).value).toBe('1-2-3');
  });
});
