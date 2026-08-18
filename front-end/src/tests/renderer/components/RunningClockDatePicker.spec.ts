// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';

import RunningClockDatePicker from '@renderer/components/RunningClockDatePicker.vue';

// Stub AppDatePicker so we can trigger `open` / `closed` events and inspect
// the `model-value` it receives without pulling in the heavy VueDatePicker dep.
// The stub is defined inline in the factory (not as a module-level variable) so
// it is safe under vi.mock hoisting. We find it in each test by component name.
vi.mock('@renderer/components/ui/AppDatePicker.vue', () => ({
  default: {
    name: 'AppDatePicker',
    props: ['modelValue', 'nowButtonVisible', 'clearable', 'minDate', 'maxDate'],
    emits: ['update:modelValue', 'open', 'closed'],
    template: '<div class="stub-date-picker"></div>',
  },
}));

function mountPicker(modelValue: Date) {
  return mount(RunningClockDatePicker, {
    props: { modelValue },
  });
}

/** Grab the AppDatePicker stub from a mounted RunningClockDatePicker wrapper. */
function getStub(wrapper: ReturnType<typeof mountPicker>) {
  return wrapper.findComponent({ name: 'AppDatePicker' });
}

describe('RunningClockDatePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('emits update:modelValue with the current time after 1 second when modelValue is in the past', async () => {
    const past = new Date(Date.now() - 5_000); // 5 seconds ago
    const wrapper = mountPicker(past);

    vi.advanceTimersByTime(1_000);
    await wrapper.vm.$nextTick();

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted!.length).toBeGreaterThanOrEqual(1);
    // The emitted value should be "now" (within this fake-timer tick).
    const emittedDate = emitted![0][0] as Date;
    expect(emittedDate).toBeInstanceOf(Date);
    expect(emittedDate.getTime()).toBeGreaterThanOrEqual(past.getTime());
  });

  test('does not emit when modelValue is already in the future', async () => {
    const future = new Date(Date.now() + 60_000); // 1 minute from now
    const wrapper = mountPicker(future);

    vi.advanceTimersByTime(1_000);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  test('emits on every 1-second tick while modelValue stays in the past', async () => {
    const past = new Date(Date.now() - 10_000);
    const wrapper = mountPicker(past);

    vi.advanceTimersByTime(3_000);
    await wrapper.vm.$nextTick();

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted!.length).toBe(3);
  });

  test('stops emitting while the picker menu is open', async () => {
    const past = new Date(Date.now() - 5_000);
    const wrapper = mountPicker(past);

    // Open the picker — interval should pause.
    await getStub(wrapper).vm.$emit('open');
    await wrapper.vm.$nextTick();

    vi.advanceTimersByTime(3_000);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  test('resumes emitting after the picker menu closes', async () => {
    const past = new Date(Date.now() - 5_000);
    const wrapper = mountPicker(past);
    const stub = getStub(wrapper);

    // Open then close — interval should restart.
    await stub.vm.$emit('open');
    await wrapper.vm.$nextTick();
    await stub.vm.$emit('closed');
    await wrapper.vm.$nextTick();

    vi.advanceTimersByTime(1_000);
    await wrapper.vm.$nextTick();

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted!.length).toBeGreaterThanOrEqual(1);
  });

  test('while open, a user-selected value is buffered and emitted on close', async () => {
    const past = new Date(Date.now() - 5_000);
    const wrapper = mountPicker(past);
    const stub = getStub(wrapper);

    await stub.vm.$emit('open');
    await wrapper.vm.$nextTick();

    // User picks a new date inside the picker.
    const userPicked = new Date(Date.now() + 120_000);
    await stub.vm.$emit('update:modelValue', userPicked);
    await wrapper.vm.$nextTick();

    // Not yet emitted upstream — still buffered.
    expect(wrapper.emitted('update:modelValue')).toBeFalsy();

    // Close commits the buffered value.
    await stub.vm.$emit('closed');
    await wrapper.vm.$nextTick();

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect((emitted![0][0] as Date).getTime()).toBe(userPicked.getTime());
  });

  test('closing without a pending edit does not emit', async () => {
    const modelValue = new Date(Date.now() + 60_000); // future — no auto-tick emission
    const wrapper = mountPicker(modelValue);
    const stub = getStub(wrapper);

    await stub.vm.$emit('open');
    await wrapper.vm.$nextTick();
    // No update:modelValue emitted by the stub while open.
    await stub.vm.$emit('closed');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  test('displayValue mirrors modelValue when the menu is closed', () => {
    const modelValue = new Date(2025, 5, 15, 12, 0, 0);
    const wrapper = mountPicker(modelValue);
    expect((getStub(wrapper).props('modelValue') as Date).getTime()).toBe(modelValue.getTime());
  });

  test('displayValue shows the pending user edit while the menu is open', async () => {
    const modelValue = new Date(Date.now() + 60_000);
    const wrapper = mountPicker(modelValue);
    const stub = getStub(wrapper);

    await stub.vm.$emit('open');
    await wrapper.vm.$nextTick();

    const userPicked = new Date(Date.now() + 120_000);
    await stub.vm.$emit('update:modelValue', userPicked);
    await wrapper.vm.$nextTick();

    expect((stub.props('modelValue') as Date).getTime()).toBe(userPicked.getTime());
  });

  test('interval is cleared on unmount — no error is thrown after time advances', async () => {
    const past = new Date(Date.now() - 5_000);
    const wrapper = mountPicker(past);

    wrapper.unmount();

    // Advance time after unmount — the interval should already be cleared so
    // no stale callback fires or throws.
    vi.advanceTimersByTime(5_000);
  });
});
