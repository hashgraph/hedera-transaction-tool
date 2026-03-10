// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import InstallUpgrade from '@renderer/components/GlobalAppProcesses/components/InstallUpgrade.vue';

describe('InstallUpgrade.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when isInstalling is false (downloaded state)', () => {
    it('should show the "Update Ready to Install" view', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: false, version: '2.0.0' },
      });

      expect(wrapper.text()).toContain('Update Ready to Install');
      expect(wrapper.text()).toContain('Version 2.0.0 has been downloaded');
    });

    it('should show Install & Restart button', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: false },
      });

      expect(wrapper.text()).toContain('Install & Restart');
    });

    it('should show default Cancel label', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: false },
      });

      expect(wrapper.text()).toContain('Cancel');
    });

    it('should show custom cancel label', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: false, cancelLabel: 'Disconnect' },
      });

      expect(wrapper.text()).toContain('Disconnect');
    });

    it('should not show the countdown or installing spinner', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: false },
      });

      expect(wrapper.text()).not.toContain('Installing Update...');
      expect(wrapper.text()).not.toContain('Closing in');
    });

    it('should emit "install" when Install & Restart is clicked', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: false },
      });

      const buttons = wrapper.findAll('button');
      const installButton = buttons.find(b => b.text().includes('Install & Restart'));
      expect(installButton).toBeDefined();
      await installButton!.trigger('click');

      expect(wrapper.emitted('install')).toHaveLength(1);
    });

    it('should emit "cancel" when Cancel is clicked', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: false },
      });

      const buttons = wrapper.findAll('button');
      const cancelButton = buttons.find(b => b.text().includes('Cancel'));
      expect(cancelButton).toBeDefined();
      await cancelButton!.trigger('click');

      expect(wrapper.emitted('cancel')).toHaveLength(1);
    });
  });

  describe('when isInstalling is true (installing state)', () => {
    it('should show the installing spinner view', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      expect(wrapper.text()).toContain('Installing Update...');
      expect(wrapper.text()).toContain('The application will close and restart automatically');
    });

    it('should not show the Install & Restart button', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      expect(wrapper.text()).not.toContain('Install & Restart');
      expect(wrapper.text()).not.toContain('Update Ready to Install');
    });

    it('should display countdown starting at 5', () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      expect(wrapper.text()).toContain('Closing in 5 seconds...');
    });

    it('should decrement the countdown each second', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      expect(wrapper.text()).toContain('Closing in 5 seconds...');

      vi.advanceTimersByTime(1000);
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Closing in 4 seconds...');

      vi.advanceTimersByTime(1000);
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Closing in 3 seconds...');

      vi.advanceTimersByTime(1000);
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Closing in 2 seconds...');

      vi.advanceTimersByTime(1000);
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Closing in 1 second...');
    });

    it('should emit "confirm-install" after 5 seconds', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      expect(wrapper.emitted('confirm-install')).toBeUndefined();

      vi.advanceTimersByTime(5000);
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('confirm-install')).toHaveLength(1);
    });

    it('should not emit "confirm-install" before 5 seconds', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      vi.advanceTimersByTime(4999);
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('confirm-install')).toBeUndefined();
    });
  });

  describe('countdown cleanup', () => {
    it('should clean up timer on unmount', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      vi.advanceTimersByTime(2000);
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Closing in 3 seconds...');

      wrapper.unmount();

      // After unmount, advancing time should not cause errors
      vi.advanceTimersByTime(5000);
    });

    it('should reset countdown when isInstalling toggles back to false', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      vi.advanceTimersByTime(2000);
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Closing in 3 seconds...');

      await wrapper.setProps({ isInstalling: false });
      expect(wrapper.text()).not.toContain('Closing in');
      expect(wrapper.text()).toContain('Update Ready to Install');

      // Advancing time should not emit confirm-install since timer was cleaned up
      vi.advanceTimersByTime(5000);
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('confirm-install')).toBeUndefined();
    });

    it('should restart countdown when isInstalling toggles true again', async () => {
      const wrapper = mount(InstallUpgrade, {
        props: { isInstalling: true },
      });

      vi.advanceTimersByTime(3000);
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Closing in 2 seconds...');

      // Toggle off
      await wrapper.setProps({ isInstalling: false });

      // Toggle on again - countdown should restart from 5
      await wrapper.setProps({ isInstalling: true });
      expect(wrapper.text()).toContain('Closing in 5 seconds...');
    });
  });
});
