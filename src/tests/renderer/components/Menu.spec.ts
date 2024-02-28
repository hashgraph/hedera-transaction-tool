import { expect, describe, test } from 'vitest';
import { mount } from '@vue/test-utils';

import { createMemoryHistory, createRouter } from 'vue-router';

import Menu from '@renderer/components/Menu.vue';

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
