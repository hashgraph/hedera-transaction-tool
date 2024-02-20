import {mount} from '@vue/test-utils';
import {expect, describe, test} from 'vitest';
import Menu from '../src/components/Menu.vue';
import {createMemoryHistory, createRouter} from 'vue-router';

const mockRouter = createRouter({
  history: createMemoryHistory(),
  routes: [],
});

const mockRoute = {
  path: '/settings',
};

describe('Menu', () => {
  test('renders menu items', async () => {
    const wrapper = mount(Menu, {
      global: {
        plugins: [mockRouter],
        mocks: {
          $route: mockRoute,
        },
      },
    });

    const menuItems = wrapper.findAll('.link-menu');
    expect(menuItems.length).toBe(4);

    expect(menuItems[0].attributes('href')).toBe('/transactions');
    expect(menuItems[0].text()).toBe('Transactions');

    const settingsLink = wrapper.find('.link-menu[href="/settings/general"]');
    expect(settingsLink.classes('active')).toBe(true);
  });
});
