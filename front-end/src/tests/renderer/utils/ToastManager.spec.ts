import { ToastManager } from '@renderer/utils/ToastManager';

const toastSuccessSpy = vi.fn();
const toastInfoSpy = vi.fn();
const toastWarningSpy = vi.fn();
const toastErrorSpy = vi.fn();
const toastMock = {
  success: toastSuccessSpy,
  info: toastInfoSpy,
  warning: toastWarningSpy,
  error: toastErrorSpy,
};

vi.mock('vue-toast-notification', () => ({
  useToast: () => toastMock,
}));

describe('ToastManager', () => {

  beforeEach(() => {
    toastSuccessSpy.mockReset();
    toastInfoSpy.mockReset();
    toastWarningSpy.mockReset();
    toastErrorSpy.mockReset();
  })

  test('check success', () => {
    const toastManager = new ToastManager();
    toastManager.success('Nice success message');
    expect(toastSuccessSpy).toHaveBeenCalled();
  });

  test('check info', () => {
    const toastManager = new ToastManager();
    toastManager.info('Nice info message');
    expect(toastInfoSpy).toHaveBeenCalled();
  });

  test('check warning', () => {
    const toastManager = new ToastManager();
    toastManager.warning('Nice warning message');
    expect(toastWarningSpy).toHaveBeenCalled();
  });

  test('check error', () => {
    const toastManager = new ToastManager();
    toastManager.error('Nice error message');
    expect(toastErrorSpy).toHaveBeenCalled();
  });

  test('check duplicated error messages', async () => {
    vi.useFakeTimers();
    const toastManager = new ToastManager();
    toastManager.error('Nice error message');
    expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    toastManager.error('Nice error message');
    expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(800);
    toastManager.error('Nice error message');
    expect(toastErrorSpy).toHaveBeenCalledTimes(2);
  });
});

