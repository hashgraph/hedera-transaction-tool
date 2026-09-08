import { ToastManager } from '@renderer/utils/ToastManager';

describe('ToastManager', () => {

  test('check success', () => {
    const toastManager = new ToastManager();
    const message = 'Nice success message';
    toastManager.success(message);
    const toastEntry = toastManager.findEntry(message);
    expect(toastEntry).not.toBeNull();
    expect(toastEntry!.type).toBe('success');
  });

  test('check info', () => {
    const toastManager = new ToastManager();
    const message = 'Nice info message';
    toastManager.info(message);
    const toastEntry = toastManager.findEntry(message);
    expect(toastEntry).not.toBeNull();
    expect(toastEntry!.type).toBe('info');
  });

  test('check warning', () => {
    const toastManager = new ToastManager();
    const message = 'Nice warning message';
    toastManager.warning(message);
    const toastEntry = toastManager.findEntry(message);
    expect(toastEntry).not.toBeNull();
    expect(toastEntry!.type).toBe('warning');
  });

  test('check error', () => {
    const toastManager = new ToastManager();
    const message = 'Nice error message';
    toastManager.error(message);
    const toastEntry = toastManager.findEntry(message);
    expect(toastEntry).not.toBeNull();
    expect(toastEntry!.type).toBe('error');
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
  });
});

