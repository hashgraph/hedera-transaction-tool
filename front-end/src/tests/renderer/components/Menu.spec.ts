// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';

import Menu from '@renderer/components/Menu.vue';

const userState = reactive<{ selectedOrganization: unknown }>({ selectedOrganization: null });
const router: Record<string, unknown> = {};
const route = { path: '/transactions' };

vi.mock('@renderer/stores/storeUser', () => ({ default: () => userState }));
vi.mock('vue-router', async importOriginal => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => router,
}));

const RouterLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
};

function mountMenu() {
  return mount(Menu, {
    global: {
      components: { RouterLink: RouterLinkStub },
      stubs: { RouterLink: RouterLinkStub },
      mocks: { $route: route },
    },
  });
}

describe('Menu.vue - smart contracts entry', () => {
  beforeEach(() => {
    delete router.appMenuItem;
    route.path = '/transactions';
    userState.selectedOrganization = null;
  });

  test('shows a Smart Contracts link to /smart-contracts without an organization', () => {
    const link = mountMenu().find('[data-testid="button-menu-smart-contracts"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toBe('Smart Contracts');
    expect(link.attributes('href')).toBe('/smart-contracts');
    expect(link.find('i').classes()).toContain('bi-file-code');
  });

  test('is active when the route is under /smart-contracts', () => {
    route.path = '/smart-contracts/add';
    const wrapper = mountMenu();
    expect(wrapper.find('[data-testid="button-menu-smart-contracts"]').classes()).toContain(
      'active',
    );
    expect(wrapper.find('[data-testid="button-menu-files"]').classes()).not.toContain('active');
  });

  test('clicking records the lowercased title as the active menu item', async () => {
    const wrapper = mountMenu();
    await wrapper.find('[data-testid="button-menu-smart-contracts"]').trigger('click');
    expect(router.appMenuItem).toBe('smart contracts');
  });

  test('is listed between Files and Contact List-only entries and is not organization-only', () => {
    const wrapper = mountMenu();
    const ids = wrapper.findAll('a').map(a => a.attributes('data-testid'));
    expect(ids.indexOf('button-menu-smart-contracts')).toBe(
      ids.indexOf('button-menu-files') + 1,
    );
    expect(ids).not.toContain('button-contact-list');
  });
});
