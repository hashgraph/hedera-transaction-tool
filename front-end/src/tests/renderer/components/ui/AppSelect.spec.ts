// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import AppSelect from '@renderer/components/ui/AppSelect.vue';

describe('AppSelect.vue', () => {
  const items = [
    { label: 'First', value: 'first' },
    { label: 'Second', value: 'second' },
  ];

  function mountSelect(props: Record<string, unknown> = {}) {
    return mount(AppSelect, {
      props: {
        items,
        value: 'first',
        toggleText: 'Pick one',
        color: 'secondary',
        ...props,
      },
      global: {
        stubs: {
          AppButton: {
            props: ['color'],
            template: '<button :data-color="color"><slot /></button>',
          },
        },
      },
    });
  }

  const toggle = (wrapper: ReturnType<typeof mountSelect>) => wrapper.find('button');
  const item = (wrapper: ReturnType<typeof mountSelect>, value: string) =>
    wrapper.find(`[data-testid="select-item-${value}"]`);

  test('shows the label of the selected item on the toggle', () => {
    const wrapper = mountSelect({ value: 'second' });

    expect(toggle(wrapper).text()).toBe('Second');
  });

  test('falls back to the toggle text when nothing matches the value', () => {
    const wrapper = mountSelect({ value: 'unknown' });

    expect(toggle(wrapper).text()).toBe('Pick one');
  });

  test('emits update:value when an item is clicked', async () => {
    const wrapper = mountSelect();

    await item(wrapper, 'second').trigger('click');

    expect(wrapper.emitted('update:value')).toEqual([['second']]);
  });

  test('marks only the selected item as active', () => {
    const wrapper = mountSelect({ value: 'second' });

    expect(item(wrapper, 'first').classes()).not.toContain('active');
    expect(item(wrapper, 'second').classes()).toContain('active');
  });

  test('shows a placeholder row when there are no items', () => {
    const wrapper = mountSelect({ items: [] });

    expect(wrapper.find('.dropdown-menu').text()).toContain('No options available');
  });

  describe('size', () => {
    const root = (wrapper: ReturnType<typeof mountSelect>) => wrapper.find('.app-select');

    test('is the default size unless size="small" is given', () => {
      expect(root(mountSelect()).classes()).not.toContain('app-select-small');
      expect(root(mountSelect({ size: 'default' })).classes()).not.toContain('app-select-small');
    });

    test('size="small" adds the small modifier to the root so CSS can restyle the toggle', () => {
      const wrapper = mountSelect({ size: 'small' });

      expect(root(wrapper).classes()).toContain('app-select-small');
    });

    test('both sizes render the label and icon hooks the stylesheet lays out', () => {
      for (const size of ['default', 'small']) {
        const wrapper = mountSelect({ size });

        expect(wrapper.find('.app-select-label').text()).toBe('First');
        expect(wrapper.find('.app-select-icon').exists()).toBe(true);
      }
    });

    test('an explicit color is applied at both sizes', () => {
      expect(toggle(mountSelect({ color: 'secondary' })).attributes('data-color')).toBe(
        'secondary',
      );
      expect(
        toggle(mountSelect({ size: 'small', color: 'secondary' })).attributes('data-color'),
      ).toBe('secondary');
    });

    test('without a color the toggle gets no color variant, at either size', () => {
      expect(toggle(mountSelect({ color: undefined })).attributes('data-color')).toBeUndefined();
      expect(
        toggle(mountSelect({ size: 'small', color: undefined })).attributes('data-color'),
      ).toBeUndefined();
    });

    test('colorOnActive still only colors the toggle while active, at the small size too', async () => {
      const wrapper = mountSelect({ size: 'small', colorOnActive: true, active: false });
      expect(toggle(wrapper).attributes('data-color')).toBeUndefined();

      await wrapper.setProps({ active: true });
      expect(toggle(wrapper).attributes('data-color')).toBe('secondary');
    });

    test('a custom buttonClass is applied at both sizes', () => {
      for (const size of ['default', 'small']) {
        const wrapper = mountSelect({ size, buttonClass: 'w-100' });

        expect(toggle(wrapper).classes()).toContain('w-100');
      }
    });

    test('items look the same at both sizes (the selected-text fix is stylesheet-only)', () => {
      for (const size of ['default', 'small']) {
        const wrapper = mountSelect({ size, value: 'second' });

        expect(item(wrapper, 'first').classes()).toContain('text-body');
        expect(item(wrapper, 'second').classes()).toEqual(
          expect.arrayContaining(['text-body', 'active']),
        );
      }
    });

    test('shows the chevron only when togglerIcon is set, at either size', async () => {
      for (const size of ['default', 'small']) {
        const wrapper = mountSelect({ size });
        expect(wrapper.find('.bi-chevron-down').exists()).toBe(false);

        await wrapper.setProps({ togglerIcon: true });
        expect(wrapper.find('.bi-chevron-down').exists()).toBe(true);
      }
    });
  });
});
