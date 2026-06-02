// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';

import CompatibilityWarningModal from '@renderer/components/Organization/CompatibilityWarningModal.vue';

function mountModal() {
  return mount(CompatibilityWarningModal, {
    props: {
      show: true,
      title: 'Update Required - Compatibility Warning',
      summaryText: 'The organization Triggering Org requires an update to version 2.0.0.',
      warningText:
        'If you proceed, all incompatible backends listed below will be disconnected before the update download starts. If you cancel, only this triggering backend will be disconnected.',
      conflicts: [
        {
          serverUrl: 'https://org-a',
          organizationName: 'Org A',
          latestSupportedVersion: '1.0.0',
          suggestedVersion: '2.0.0',
        },
        {
          serverUrl: 'https://org-b',
          organizationName: 'Org B',
          latestSupportedVersion: '0.9.0',
          suggestedVersion: '2.0.0',
        },
      ],
      conflictsTitle: 'Incompatible Organizations',
      cancelLabel: 'Disconnect This Backend',
      proceedLabel: 'Disconnect Incompatible Backends and Continue',
    },
    global: {
      stubs: {
        AppModal: {
          props: ['show'],
          template: '<div v-if="show"><slot /></div>',
        },
        AppButton: {
          template: '<button v-bind="$attrs"><slot /></button>',
        },
      },
    },
  });
}

describe('CompatibilityWarningModal', () => {
  test('renders mandatory warning copy and emits proceed/cancel events', async () => {
    const wrapper = mountModal();

    expect(wrapper.text()).toContain('Update Required - Compatibility Warning');
    expect(wrapper.text()).toContain('The organization Triggering Org requires an update to version 2.0.0.');
    expect(wrapper.text()).toContain(
      'If you proceed, all incompatible backends listed below will be disconnected before the update download starts. If you cancel, only this triggering backend will be disconnected.',
    );
    expect(wrapper.text()).toContain('Disconnect Incompatible Backends and Continue');
    expect(wrapper.text()).toContain('Disconnect This Backend');
    expect(wrapper.text()).toContain('Org A');
    expect(wrapper.text()).toContain('Latest supported version: 1.0.0');
    expect(wrapper.text()).toContain('Org B');
    expect(wrapper.text()).toContain('Latest supported version: 0.9.0');

    await wrapper.get('button[type="button"]').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);
  });
});



