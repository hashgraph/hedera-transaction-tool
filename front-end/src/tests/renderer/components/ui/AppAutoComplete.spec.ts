// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import AppAutoComplete from '@renderer/components/ui/AppAutoComplete.vue';

type MatchResult = { index: number; alignStart: number } | null;

type Props = Partial<{
  modelValue: string;
  items: string[];
  sanitize: (value: string) => string;
  findMatch: (items: string[], input: string) => MatchResult;
  decorate: (value: string) => string;
  strictItems: boolean;
  wrapNavigation: boolean;
  disableSpaces: boolean;
  tabularNums: boolean;
  ignoreItem: (item: string) => boolean;
}>;

// Mounts AppAutoComplete behind a tiny host component that actually binds
// v-model, rather than mounting it bare. AppAutoComplete's modelValue is a
// computed({ get, set }) over props.modelValue + emit — calling setValue()
// only *emits*; nothing re-feeds that back as a new prop unless something is
// actually listening, same as the real AccountIdInput -> parent round trip.
// Without this host, `modelValue.value` would never change after any
// interaction, and every test would silently no-op.
function mountAutoComplete(initialProps: Props = {}, mountOptions: Record<string, unknown> = {}) {
  const { modelValue: initialModelValue = '', ...rest } = initialProps;

  const Host = defineComponent({
    data() {
      return { modelValue: initialModelValue };
    },
    render() {
      return h(AppAutoComplete, {
        modelValue: this.modelValue,
        'onUpdate:modelValue': (value: string) => {
          this.modelValue = value;
        },
        items: [] as string[],
        sanitize: vi.fn((value: string) => value),
        findMatch: vi.fn((): MatchResult => null),
        ...rest,
      });
    },
  });

  return mount(Host, mountOptions);
}

describe('AppAutoComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('smoke: mounts and renders an input', () => {
    const wrapper = mountAutoComplete({ items: ['a', 'b', 'c'] });
    expect(wrapper.find('input').exists()).toBe(true);
  });

  test('smoke: typing round-trips through v-model and calls findMatch', async () => {
    const findMatch = vi.fn((items: string[], input: string): MatchResult => {
      const index = items.findIndex(i => i.startsWith(input));
      return index === -1 ? null : { index, alignStart: 0 };
    });
    const wrapper = mountAutoComplete({ items: ['apple', 'banana'], findMatch });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('app');
    await flushPromises();
    expect(findMatch).toHaveBeenCalledWith(['apple', 'banana'], 'app');
  });

  // A. sanitize runs on every keystroke and its output is authoritative
  test('A1: sanitize output becomes modelValue and forces the native input value', async () => {
    const sanitize = vi.fn((value: string) => value.toUpperCase());
    const wrapper = mountAutoComplete({ sanitize });
    const input = wrapper.find('input');
    await input.setValue('abc');
    await flushPromises();
    expect(sanitize).toHaveBeenCalledWith('abc');
    expect((input.element as HTMLInputElement).value).toBe('ABC');
  });

  // B. strictItems gating while typing
  function prefixMatcher(): (items: string[], input: string) => MatchResult {
    return (items, input) => {
      const index = items.findIndex(i => i.toLowerCase().startsWith(input.toLowerCase()));
      return index === -1 ? null : { index, alignStart: 0 };
    };
  }

  test('B1: strictItems false accepts a value matching nothing', async () => {
    const wrapper = mountAutoComplete({ strictItems: false, findMatch: prefixMatcher() });
    const input = wrapper.find('input');
    await input.setValue('xyz');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('xyz');
  });

  test('B2: strictItems true rejects a keystroke matching no item prefix', async () => {
    const wrapper = mountAutoComplete({
      strictItems: true,
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.setValue('T');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('T');

    await input.setValue('Tx');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('T');
  });

  test('B3: strictItems true always accepts backspacing to empty', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'Transfer',
      strictItems: true,
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.setValue('');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  test('B4: strictItems true accepts a matching value and highlights it', async () => {
    const wrapper = mountAutoComplete({
      strictItems: true,
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('App');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('App');
    const rows = wrapper.findAll('.autocomplete-item-custom');
    const selected = rows.find(r => r.classes().includes('selected'));
    expect(selected?.text()).toBe('Approve');
  });

  test('B5: strictItems true with empty items rejects every non-empty keystroke', async () => {
    const wrapper = mountAutoComplete({ strictItems: true, items: [], findMatch: prefixMatcher() });
    const input = wrapper.find('input');
    await input.setValue('a');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  // C. Live ghost suggestion while typing
  test('C1: live match while typing computes prefix/postfix ghosts and highlights + scrolls', async () => {
    const wrapper = mountAutoComplete({
      items: ['0.0.100', '0.0.200'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {});

    await input.setValue('0.0.1');
    await flushPromises();

    const [prefix, postfix] = wrapper.findAll('.autocomplete-suggestion');
    expect(prefix.text()).toBe('');
    expect(postfix.text()).toBe('00');
    const rows = wrapper.findAll('.autocomplete-item-custom');
    const selected = rows.find(r => r.classes().includes('selected'));
    expect(selected?.text()).toBe('0.0.100');
    expect(scrollSpy).toHaveBeenCalled();

    scrollSpy.mockRestore();
  });

  test('C2: typed value matching nothing clears both ghosts and highlight', async () => {
    const wrapper = mountAutoComplete({ items: ['apple', 'banana'], findMatch: prefixMatcher() });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('zzz');
    await flushPromises();
    const [prefix, postfix] = wrapper.findAll('.autocomplete-suggestion');
    expect(prefix.text()).toBe('');
    expect(postfix.text()).toBe('');
    expect(wrapper.findAll('.autocomplete-item-custom.selected')).toHaveLength(0);
  });

  test('C3: findMatch alignStart -1 still highlights but shows no ghost text', async () => {
    const findMatch = vi.fn((): MatchResult => ({ index: 1, alignStart: -1 }));
    const wrapper = mountAutoComplete({ items: ['apple', 'banana'], findMatch });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('b');
    await flushPromises();
    const [prefix, postfix] = wrapper.findAll('.autocomplete-suggestion');
    expect(prefix.text()).toBe('');
    expect(postfix.text()).toBe('');
    const rows = wrapper.findAll('.autocomplete-item-custom');
    expect(rows[1].classes()).toContain('selected');
  });

  test('C4: clearing to empty short-circuits before findMatch is called', async () => {
    const findMatch = vi.fn(prefixMatcher());
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['apple', 'banana'],
      findMatch,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    findMatch.mockClear();
    await input.setValue('');
    await flushPromises();
    expect(findMatch).not.toHaveBeenCalled();
    const [prefix, postfix] = wrapper.findAll('.autocomplete-suggestion');
    expect(prefix.text()).toBe('');
    expect(postfix.text()).toBe('');
    expect(wrapper.findAll('.autocomplete-item-custom.selected')).toHaveLength(0);
  });

  // D. Dropdown stays open while typing
  test('D1: dropdown stays open when backspacing to empty', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['apple', 'banana'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('');
    await flushPromises();
    const dropdown = wrapper.find('.autocomplete-custom');
    expect(dropdown.attributes('style')).toContain('visibility: visible');
  });

  // E. Escape
  test('E1: strictItems false leaves modelValue untouched after Escape', async () => {
    const wrapper = mountAutoComplete({
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      strictItems: false,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('0.0.2');
    await flushPromises();
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('0.0.2');
  });

  test('E2: strictItems true reverts to valueOnFocus after Escape', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'Transfer',
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('App');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('App');
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Transfer');
  });

  test('E3: Escape closes dropdown and hides prefix ghost', async () => {
    const wrapper = mountAutoComplete({ items: ['0.0.100'], findMatch: prefixMatcher() });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('0.0.1');
    await flushPromises();
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    const dropdown = wrapper.find('.autocomplete-custom');
    expect(dropdown.attributes('style')).toContain('visibility: hidden');
    const [prefix] = wrapper.findAll('.autocomplete-suggestion');
    expect(prefix.classes()).toContain('d-none');
  });

  test('E4: Escape switches postfix ghost source from findMatch to decorate', async () => {
    const decorate = vi.fn((value: string) => (value ? '-fresh' : ''));
    const wrapper = mountAutoComplete({
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      decorate,
      strictItems: false,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('0.0.2');
    await flushPromises();
    const [, postfixBefore] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfixBefore.text()).toBe('58'); // live findMatch suggestion toward 0.0.258

    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    const [, postfixAfter] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfixAfter.text()).toBe('-fresh');
    expect(decorate).toHaveBeenCalledWith('0.0.2');
  });

  test('E5a: Tab does not accept the suggestion immediately after Escape', async () => {
    const wrapper = mountAutoComplete({ items: ['0.0.258'], findMatch: prefixMatcher() });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('0.0.2');
    await flushPromises();
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await input.trigger('keydown', { key: 'Tab' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('0.0.2');
  });

  test('E5b: Enter does not accept the suggestion immediately after Escape (strictItems true)', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'App',
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('App');
  });

  test('E6: Escape then ArrowRight twice completes once the ghost catches up', async () => {
    const wrapper = mountAutoComplete({
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      strictItems: false,
    });
    const input = wrapper.find('input');
    const el = input.element as HTMLInputElement;
    await input.trigger('focus');
    await input.setValue('0.0.2');
    await flushPromises();
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();

    el.setSelectionRange(el.value.length, el.value.length);
    await input.trigger('keydown', { key: 'ArrowRight' });
    await flushPromises();
    expect(el.value).toBe('0.0.2');

    el.setSelectionRange(el.value.length, el.value.length);
    await input.trigger('keydown', { key: 'ArrowRight' });
    await flushPromises();
    expect(el.value).toBe('0.0.25');
  });

  // N. Enter
  test('N1: strictItems true merges the live suggestion on Enter', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('App');
    await flushPromises();
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Approve');
  });

  test('N2: strictItems true skips the merge if Escape preceded Enter', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'App',
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('App');
  });

  test('N3: strictItems false always commits the literal typed text, trimmed', async () => {
    const wrapper = mountAutoComplete({
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      strictItems: false,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('0.0.2 ');
    await flushPromises();
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('0.0.2');
  });

  test('N4: Enter calls preventDefault when nonempty', async () => {
    const wrapper = mountAutoComplete({ modelValue: 'a' });
    const input = wrapper.find('input');
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    input.element.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(true);
  });

  test('N5: Enter closes the dropdown', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['apple'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    const dropdown = wrapper.find('.autocomplete-custom');
    expect(dropdown.attributes('style')).toContain('visibility: hidden');
  });

  test('N6: Enter moves focus to the next focusable element', async () => {
    const wrapper = mountAutoComplete(
      { modelValue: 'Transfer', items: ['Transfer', 'Approve'], findMatch: prefixMatcher() },
      { attachTo: document.body },
    );
    // Appended after mounting so it lands after the input in DOM order — focusNextElement
    // walks document order via querySelectorAll, so order here matters.
    const button = document.createElement('button');
    document.body.appendChild(button);
    const input = wrapper.find('input').element as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    await wrapper.find('input').trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(document.activeElement).toBe(button);

    wrapper.unmount();
    button.remove();
  });

  test('N7: Enter on an empty field does not run the handler at all', async () => {
    const wrapper = mountAutoComplete({ modelValue: '' });
    const input = wrapper.find('input');
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    input.element.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(false);
  });

  // T. Tab
  test('T1: Tab on an empty field does not run the handler at all', async () => {
    const wrapper = mountAutoComplete({ modelValue: '' });
    const input = wrapper.find('input');
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    input.element.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(false);
  });

  test.each([true, false])(
    'T2: Tab commits the full matched item regardless of strictItems (%s)',
    async strictItems => {
      const wrapper = mountAutoComplete({
        items: ['Transfer', 'Approve'],
        findMatch: prefixMatcher(),
        strictItems,
      });
      const input = wrapper.find('input');
      await input.trigger('focus');
      await input.setValue('App');
      await flushPromises();
      await input.trigger('keydown', { key: 'Tab' });
      await flushPromises();
      expect((input.element as HTMLInputElement).value).toBe('Approve');
    },
  );

  test('T3: strictItems false leaves value as typed when nothing is highlighted', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer'],
      findMatch: prefixMatcher(),
      strictItems: false,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('zzz');
    await flushPromises();
    await input.trigger('keydown', { key: 'Tab' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('zzz');
  });

  test('T4: Tab skips the merge if Escape preceded it', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'App',
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await input.trigger('keydown', { key: 'Tab' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('App');
  });

  test('T5: Tab closes the dropdown', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['apple'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'Tab' });
    await flushPromises();
    const dropdown = wrapper.find('.autocomplete-custom');
    expect(dropdown.attributes('style')).toContain('visibility: hidden');
  });

  test('T6: Tab never calls preventDefault', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['apple'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    input.element.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(false);
  });

  // Arrow keys
  test('U1: ArrowUp moves to the previous item and suppresses native default', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'b',
      items: ['a', 'b', 'c'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    input.element.dispatchEvent(event);
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('a');
    expect(event.defaultPrevented).toBe(true);
  });

  test('U2: wrapNavigation true wraps ArrowUp from the first item to the last', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['a', 'b', 'c'],
      findMatch: prefixMatcher(),
      wrapNavigation: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'ArrowUp' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('c');
  });

  test('U3: wrapNavigation false (default) keeps ArrowUp at the first item', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['a', 'b', 'c'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'ArrowUp' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('a');
  });

  test('D1: ArrowDown moves to the next item, and from nothing-selected goes to the first', async () => {
    const wrapper = mountAutoComplete({ items: ['a', 'b', 'c'], findMatch: prefixMatcher() });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('a');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('b');
  });

  test('D2: wrapNavigation true wraps ArrowDown from the last item to the first', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'c',
      items: ['a', 'b', 'c'],
      findMatch: prefixMatcher(),
      wrapNavigation: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('a');
  });

  test('D3: wrapNavigation false (default) keeps ArrowDown at the last item', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'c',
      items: ['a', 'b', 'c'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('c');
  });

  test('R1: ArrowRight with cursor not at end does nothing special', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'ab',
      items: ['abc'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    const el = input.element as HTMLInputElement;
    await input.trigger('focus');
    await flushPromises();
    el.setSelectionRange(0, 0);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    el.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(false);
    expect(el.value).toBe('ab');
  });

  test('R2: ArrowRight at end with a postfix ghost completes one character', async () => {
    const wrapper = mountAutoComplete({
      modelValue: '0.0.2',
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    const el = input.element as HTMLInputElement;
    await input.trigger('focus');
    await flushPromises();
    el.setSelectionRange(el.value.length, el.value.length);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    el.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(true);
    expect(el.value).toBe('0.0.25');
  });

  test('R3: ArrowRight at end with no postfix ghost is a true no-op', async () => {
    const wrapper = mountAutoComplete({
      modelValue: '0.0.258',
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    const el = input.element as HTMLInputElement;
    await input.trigger('focus');
    await flushPromises();
    el.setSelectionRange(el.value.length, el.value.length);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    el.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(false);
    expect(el.value).toBe('0.0.258');
  });

  test('L1: ArrowLeft has no handler and never calls preventDefault', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'ab',
      items: ['abc'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    input.element.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(false);
  });

  // F. Focus
  test('F1: valueOnFocus snapshots modelValue at focus time, not later', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus'); // snapshots '' (initial modelValue)
    await flushPromises();
    // Something else changes modelValue after focus, not via typing (e.g. a parent
    // update) — valueOnFocus must stay pinned to what it was AT focus time.
    await wrapper.setData({ modelValue: 'Transfer' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Transfer');
    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  test('F2: focus selects the entire text after a tick', async () => {
    const wrapper = mountAutoComplete({ modelValue: 'Transfer' });
    const input = wrapper.find('input');
    const el = input.element as HTMLInputElement;
    const selectSpy = vi.spyOn(el, 'select');
    await input.trigger('focus');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(selectSpy).toHaveBeenCalled();
  });

  test('F3: focus reopens the dropdown and switches postfix back to findMatch', async () => {
    const decorate = vi.fn(() => '-decorated');
    const wrapper = mountAutoComplete({
      modelValue: '0.0.2',
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      decorate,
    });
    const [, postfixAtRest] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfixAtRest.text()).toBe('-decorated');

    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    const dropdown = wrapper.find('.autocomplete-custom');
    expect(dropdown.attributes('style')).toContain('visibility: visible');
    const [prefix, postfixAfterFocus] = wrapper.findAll('.autocomplete-suggestion');
    expect(prefix.classes()).not.toContain('d-none');
    expect(postfixAfterFocus.text()).toBe('58');
  });

  test('F4: focus scrolls to the current selection', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'b',
      items: ['a', 'b', 'c'],
      findMatch: prefixMatcher(),
    });
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {});
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  // Bl. Blur
  test('Bl1: strictItems false forces nothing on blur', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: false,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('zzz');
    await flushPromises();
    await input.trigger('blur');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('zzz');
  });

  test('Bl2: strictItems true with empty modelValue forces nothing on blur', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('blur');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  test('Bl3: strictItems true forces a partial match to the full item on blur', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('Tra');
    await flushPromises();
    await input.trigger('blur');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Transfer');
  });

  test('Bl4: strictItems true leaves an already-exact match untouched on blur', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      strictItems: true,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('Transfer');
    await flushPromises();
    await input.trigger('blur');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Transfer');
  });

  // Bl5 (fallback to valueOnFocus when strictItems finds nothing at blur) is skipped:
  // it's only reachable if findMatch disagrees with itself between the keystroke gate
  // and the blur check for the *same* modelValue, which Vue's computed caching makes
  // impractical to force from outside — currentMatch won't re-invoke findMatch unless
  // modelValue actually changes. Consistent with the code comment: "shouldn't normally
  // be reachable."

  test('Bl6: blur always closes the dropdown', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'a',
      items: ['apple'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await input.trigger('blur');
    await flushPromises();
    const dropdown = wrapper.find('.autocomplete-custom');
    expect(dropdown.attributes('style')).toContain('visibility: hidden');
  });

  test('adjacent: clicking outside the component closes the dropdown', async () => {
    const wrapper = mountAutoComplete(
      { modelValue: 'a', items: ['apple'], findMatch: prefixMatcher() },
      { attachTo: document.body },
    );
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    const dropdownBefore = wrapper.find('.autocomplete-custom');
    expect(dropdownBefore.attributes('style')).toContain('visibility: visible');

    document.body.dispatchEvent(new Event('click', { bubbles: true }));
    await flushPromises();

    const dropdownAfter = wrapper.find('.autocomplete-custom');
    expect(dropdownAfter.attributes('style')).toContain('visibility: hidden');
    wrapper.unmount();
  });

  // Dc. decorate / checksum-at-rest
  // Dc3 (incomplete/invalid value -> no ghost) and Dc5 (reopening switches source back,
  // proven via a visibly different findMatch suggestion) aren't duplicated here — Dc3's
  // real content is `decorateAccountId`'s own parsing contract (belongs with its pure-
  // function tests), and Dc5 is exactly what F3 already proves.
  test('Dc1: empty modelValue shows no decorate ghost', async () => {
    const decorate = vi.fn((value: string) => (value ? '-x' : ''));
    const wrapper = mountAutoComplete({ items: [], findMatch: prefixMatcher(), decorate });
    const [, postfix] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfix.text()).toBe('');
    expect(decorate).toHaveBeenCalledWith('');
  });

  test('Dc2: at-rest ghost shows decorate output regardless of list membership', async () => {
    const decorate = vi.fn((value: string) => `-${value.length}`);
    const notInList = mountAutoComplete({
      modelValue: '0.0.2',
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      decorate,
    });
    const [, postfix1] = notInList.findAll('.autocomplete-suggestion');
    expect(postfix1.text()).toBe('-5');

    const inList = mountAutoComplete({
      modelValue: '0.0.258',
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      decorate,
    });
    const [, postfix2] = inList.findAll('.autocomplete-suggestion');
    expect(postfix2.text()).toBe('-7');
  });

  test('Dc4: blur recomputes decorate fresh for the committed value, not a stale findMatch match', async () => {
    const decorate = vi.fn((value: string) => (value ? `-fresh(${value})` : ''));
    const wrapper = mountAutoComplete({
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
      decorate,
      strictItems: false,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await input.setValue('0.0.2');
    await flushPromises();
    const [, postfixWhileTyping] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfixWhileTyping.text()).toBe('58');

    await input.trigger('blur');
    await flushPromises();
    const [, postfixAfterBlur] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfixAfterBlur.text()).toBe('-fresh(0.0.2)');
  });

  test('Dc6: findMatch-driven and decorate-driven postfix agree for a known item', async () => {
    const decorate = vi.fn((value: string) => (value === '0.0.258' ? '-abcde' : ''));
    const items = ['0.0.258-abcde'];
    const findMatch = vi.fn((itemsArg: string[], input: string): MatchResult => {
      const index = itemsArg.findIndex(i => i.startsWith(input));
      return index === -1 ? null : { index, alignStart: 0 };
    });

    const wrapper = mountAutoComplete({ modelValue: '0.0.258', items, findMatch, decorate });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    const [, postfixOpen] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfixOpen.text()).toBe('-abcde'); // from findMatch's alignStart slice

    await input.trigger('blur');
    await flushPromises();
    const [, postfixClosed] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfixClosed.text()).toBe('-abcde'); // from decorate — same value
  });

  test('Dc7: no decorate supplied means no at-rest ghost ever', async () => {
    const wrapper = mountAutoComplete({
      modelValue: '0.0.2',
      items: ['0.0.258'],
      findMatch: prefixMatcher(),
    });
    const [, postfix] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfix.text()).toBe('');
  });

  test('Dc8: decorate is never consulted while the dropdown is open', async () => {
    const decorate = vi.fn(() => '-should-not-appear');
    const wrapper = mountAutoComplete({ items: ['apple'], findMatch: prefixMatcher(), decorate });
    const input = wrapper.find('input');
    // decorate('') fires once at mount (isOpen starts false) — clear before the part
    // of the scenario we're actually asserting on (open + no findMatch result).
    decorate.mockClear();
    await input.trigger('focus');
    await input.setValue('zzz');
    await flushPromises();
    const [, postfix] = wrapper.findAll('.autocomplete-suggestion');
    expect(postfix.text()).toBe('');
    expect(decorate).not.toHaveBeenCalled();
  });

  // M. Mouse-click row selection
  test('M1: clicking a row commits that item directly and closes the dropdown', async () => {
    const sanitize = vi.fn((value: string) => value);
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
      sanitize,
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    sanitize.mockClear();
    const rows = wrapper.findAll('.autocomplete-item-custom');
    await rows[1].trigger('click');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Approve');
    expect(sanitize).not.toHaveBeenCalled();
    const dropdown = wrapper.find('.autocomplete-custom');
    expect(dropdown.attributes('style')).toContain('visibility: hidden');
  });

  test.each([true, false])(
    'M2: clicking a row works identically regardless of strictItems (%s)',
    async strictItems => {
      const wrapper = mountAutoComplete({
        items: ['Transfer', 'Approve'],
        findMatch: prefixMatcher(),
        strictItems,
      });
      const input = wrapper.find('input');
      await input.trigger('focus');
      await flushPromises();
      const rows = wrapper.findAll('.autocomplete-item-custom');
      await rows[0].trigger('click');
      await flushPromises();
      expect((input.element as HTMLInputElement).value).toBe('Transfer');
    },
  );

  test('M3: clicking a non-highlighted row wins over the current selection', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'T',
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    const rows = wrapper.findAll('.autocomplete-item-custom');
    await rows[1].trigger('click');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Approve');
  });

  test('M4: .selected moves to the clicked row', async () => {
    const wrapper = mountAutoComplete({
      items: ['Transfer', 'Approve'],
      findMatch: prefixMatcher(),
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    const rows = wrapper.findAll('.autocomplete-item-custom');
    await rows[1].trigger('click');
    await flushPromises();
    const rowsAfter = wrapper.findAll('.autocomplete-item-custom');
    expect(rowsAfter[1].classes()).toContain('selected');
    expect(rowsAfter[0].classes()).not.toContain('selected');
  });

  // M5 (clicking a row doesn't blur the input) isn't independently testable here:
  // happy-dom doesn't implement the native "mousedown shifts focus" behavior that
  // @mousedown.prevent exists to suppress, so document.activeElement never changes
  // from a synthetic mousedown regardless of whether the prevent is present. This is
  // the same class of limitation as the pixel-positioning math — needs a real browser.

  test('M6: clicking a row does not bubble to an outer click listener', async () => {
    const wrapper = mountAutoComplete(
      { items: ['Transfer'], findMatch: prefixMatcher() },
      { attachTo: document.body },
    );
    const outerListener = vi.fn();
    document.body.addEventListener('click', outerListener);
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    const rows = wrapper.findAll('.autocomplete-item-custom');
    await rows[0].trigger('click');
    await flushPromises();
    expect(outerListener).not.toHaveBeenCalled();
    document.body.removeEventListener('click', outerListener);
    wrapper.unmount();
  });

  test('M7: clicking the separator does not change the value', async () => {
    const wrapper = mountAutoComplete({
      modelValue: 'x',
      items: ['Transfer', '---', 'Approve'],
      findMatch: vi.fn((): MatchResult => null),
      ignoreItem: (item: string) => item === '---',
    });
    const input = wrapper.find('input');
    await input.trigger('focus');
    await flushPromises();
    await wrapper.find('.autocomplete-item-separator').trigger('click');
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('x');
  });
});
