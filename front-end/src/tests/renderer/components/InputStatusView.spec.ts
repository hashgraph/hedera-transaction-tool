// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { InputStatus } from '@renderer/components/InputStatus.ts';
import InputStatusView from '@renderer/components/InputStatusView.vue';

describe('InputStatusView.vue', () => {

  test('Full cycle', async () => {
    // 1) Mount
    const wrapper = mount(InputStatusView, {
      props: {
        status: InputStatus.empty,
        invalidMessage: 'My error message',
      },
    });

    // 2) status == InputStatus.empty => not visible
    await flushPromises();
    expect(wrapper.find('span').classes('opacity-0')).toBe(true);

    // 3) status == InputStatus.valid => not visible
    await wrapper.setProps({ status: InputStatus.valid });
    expect(wrapper.find('span').classes('opacity-0')).toBe(true);

    // 4) status == InputStatus.invalid => visible
    await wrapper.setProps({ status: InputStatus.invalid });
    expect(wrapper.find('span').classes('opacity-100')).toBe(true);
    expect(wrapper.text()).toBe('My error message');

    // 5) status == InputStatus.empty => not visible
    await wrapper.setProps({ status: InputStatus.empty });
    expect(wrapper.find('span').classes('opacity-0')).toBe(true);
  });

});
