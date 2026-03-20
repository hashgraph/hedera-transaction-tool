import { inject, provide } from 'vue';
import { useToast } from 'vue-toast-notification';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.toastManager');

export class ToastManager {
  private static readonly injectKey = Symbol();

  private readonly toast = useToast();
  private readonly displayedErrors = new Set<string>();
  private readonly maxDisplayedErrorCount = 4;

  //
  // Public
  //

  public success(message: string) {
    this.toast.success(message, {
      duration: 4000,
    });
  }

  public info(message: string) {
    this.toast.info(message, {
      duration: 4000,
    });
  }

  public warning(message: string) {
    this.toast.warning(message, {
      duration: 4000,
    });
  }

  public error(message: string) {
    if (this.displayedErrors.has(message) || this.displayedErrors.size >= this.maxDisplayedErrorCount) {
      // We display message in console
      logger.debug('Hidden error message', { message });
    } else {
      this.displayedErrors.add(message);
      this.toast.error(message, {
        duration: 0,
        onDismiss: () => {
          this.displayedErrors.delete(message);
        },
      });
    }
  }

  //
  // Public (static)
  //

  public static provide(): void {
    provide(ToastManager.injectKey, new ToastManager());
  }

  public static inject(): ToastManager {
    const defaultFactory = () => new ToastManager();
    return inject<ToastManager>(ToastManager.injectKey, defaultFactory, true);
  }
}
