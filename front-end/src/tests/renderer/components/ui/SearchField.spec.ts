// @vitest-environment happy-dom

import { mount } from '@vue/test-utils';
import SearchField from '@renderer/components/SearchField/SearchField.vue';

describe('SearchField.vue', () => {
  test('SearchField - props.placeholder', () => {
    const placeholder = 'some placeholder';
    const wrapper = mount(SearchField, {
      props: { searchText: '', placeholder },
    });
    const input = wrapper.find('input');
    expect(input.attributes('placeholder')).toBe(placeholder);
  });

  test('SearchField - props.searchText', async () => {
    const wrapper = mount(SearchField, {
      props: {
        searchText: 'some search text',
        placeholder: 'some placeholder',
      },
    });
    const input = wrapper.find('input')
    expect(input.element.value).toBe('some search text');
    await wrapper.setProps({
      searchText: 'other search text',
    });
    expect(input.element.value).toBe('other search text');
  });

  test('SearchField - @update:searchText', async () => {
    const wrapper = mount(SearchField, {
      props: {
        searchText: 'some search text',
        placeholder: 'some placeholder' },
    });
    const input = wrapper.find('input');
    await input.setValue('other search text');
    const updateSearchText = wrapper.emitted('update:searchText');
    expect(updateSearchText).toHaveLength(1);
    expect(updateSearchText![0]).toStrictEqual(['other search text']);
  });

  test('SearchField - props.autofocus = true', async () => {
    const wrapper = mount(SearchField, {
      attachTo: document.body, // Required to use document.activeElement
      props: {
        searchText: 'some search text',
        placeholder: 'some placeholder',
        autofocus: true,
      },
    });
    const input = wrapper.find('input');
    expect(input.element).toBe(document.activeElement);
    wrapper.unmount(); // Needed because attachTo: is used
  });

  test('SearchField - props.autofocus = false', async () => {
    const wrapper = mount(SearchField, {
      attachTo: document.body, // Required to use document.activeElement
      props: {
        searchText: 'some search text',
        placeholder: 'some placeholder',
        autofocus: false,
      },
    });
    const input = wrapper.find('input');
    expect(input.element).not.toBe(document.activeElement);
    wrapper.unmount(); // Needed because attachTo: is used
  });
});
