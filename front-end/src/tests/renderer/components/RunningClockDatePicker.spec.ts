// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';
import AppDatePicker from '@renderer/components/ui/AppDatePicker.vue';

vi.mock('@renderer/components/ui/AppDatePicker.vue', async () => {
  const { defineComponent } = await import('vue');
  return {
    default: defineComponent({
      props: ['modelValue', 'minDate', 'maxDate', 'clearable', 'nowButtonVisible'],
      emits: ['update:modelValue', 'open', 'closed'],
      template: '<div><slot /></div>',
    }),
  };
});

describe('RunningClockDatePicker.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits update:modelValue when modelValue is in the past after 1 second', () => {
    const pastDate = new Date(Date.now() - 5000);
    const wrapper = mount(RunningClockDatePicker, {
      props: { modelValue: pastDate },
    });

    vi.advanceTimersByTime(1001);

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBeInstanceOf(Date);

    wrapper.unmount();
  });

  it('does not emit update:modelValue when modelValue is in the future after 1 second', () => {
    const futureDate = new Date(Date.now() + 60_000);
    const wrapper = mount(RunningClockDatePicker, {
      props: { modelValue: futureDate },
    });

    vi.advanceTimersByTime(1001);

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();

    wrapper.unmount();
  });

  it('stops the interval when the picker menu opens', () => {
    const pastDate = new Date(Date.now() - 5000);
    const wrapper = mount(RunningClockDatePicker, {
      props: { modelValue: pastDate },
    });

    wrapper.findComponent(AppDatePicker).vm.$emit('open');
    vi.advanceTimersByTime(1001);

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();

    wrapper.unmount();
  });

  it('resumes the interval after the picker menu closes', () => {
    const pastDate = new Date(Date.now() - 5000);
    const wrapper = mount(RunningClockDatePicker, {
      props: { modelValue: pastDate },
    });

    wrapper.findComponent(AppDatePicker).vm.$emit('open');
    wrapper.findComponent(AppDatePicker).vm.$emit('closed');
    vi.advanceTimersByTime(1001);

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBeInstanceOf(Date);

    wrapper.unmount();
  });

  it('does not emit after the component is unmounted', () => {
    const pastDate = new Date(Date.now() - 5000);
    const wrapper = mount(RunningClockDatePicker, {
      props: { modelValue: pastDate },
    });

    wrapper.unmount();
    vi.advanceTimersByTime(1001);

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });
});
