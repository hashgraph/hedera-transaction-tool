import { ToastManager } from '@renderer/utils/ToastManager';

describe('ToastManager', () => {

  test('check success', () => {
    const toastManager = new ToastManager();
    const message = 'Nice success message';
    toastManager.success(message);
    expect(toastManager.findEntry(message, 'success')).not.toBeNull();
  });

  test('check info', () => {
    const toastManager = new ToastManager();
    const message = 'Nice info message';
    toastManager.info(message);
    expect(toastManager.findEntry(message, 'info')).not.toBeNull();
  });

  test('check warning', () => {
    const toastManager = new ToastManager();
    const message = 'Nice warning message';
    toastManager.warning(message);
    expect(toastManager.findEntry(message, 'warning')).not.toBeNull();
  });

  test('check error', () => {
    const toastManager = new ToastManager();
    const message = 'Nice error message';
    toastManager.error(message);
    expect(toastManager.findEntry(message, 'error')).not.toBeNull();
  });

  test('check dismiss after timeout', () => {
    vi.useFakeTimers();
    const toastManager = new ToastManager();
    const message = 'Nice success message';
    toastManager.success(message);
    expect(toastManager.findEntry(message, 'success')).not.toBeNull();
    vi.advanceTimersByTime(4000);
    expect(toastManager.findEntry(message, 'success')).toBeNull();
    vi.useRealTimers();
  });

  test('check duplicated error messages', async () => {
    vi.useFakeTimers();
    const toastManager = new ToastManager();
    const message = 'Nice error message';
    toastManager.error(message);
    expect(toastManager.countErrorEntries()).toBe(1);
    toastManager.error(message);
    expect(toastManager.countErrorEntries()).toBe(1);
    vi.advanceTimersByTime(800);
    toastManager.error(message);
    expect(toastManager.countErrorEntries()).toBe(1);
    vi.useRealTimers();
  });

  test('a new toast in the same group replaces the previous one for that group', () => {
    const toastManager = new ToastManager();
    toastManager.success('First message', 'group-1');
    toastManager.success('Second message', 'group-1');

    expect(toastManager.entries.value).toHaveLength(1);
    expect(toastManager.findEntry('First message', 'success')).toBeNull();
    expect(toastManager.findEntry('Second message', 'success')).not.toBeNull();
  });

  test('toasts without a group id do not replace each other', () => {
    const toastManager = new ToastManager();
    toastManager.success('First message');
    toastManager.success('Second message');

    expect(toastManager.entries.value).toHaveLength(2);
  });

  test('a grouped toast does not replace toasts from a different group', () => {
    const toastManager = new ToastManager();
    toastManager.success('First message', 'group-1');
    toastManager.success('Second message', 'group-2');

    expect(toastManager.entries.value).toHaveLength(2);
  });
});

