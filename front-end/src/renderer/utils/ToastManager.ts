import { inject, provide } from 'vue';
import { useToast } from 'vue-toast-notification';

export class ToastManager {
  private static readonly injectKey = Symbol();

  private readonly toast = useToast();
  private readonly timers = new Map<string, number>();
  private readonly duplicateTimeout = 700; // If two same errors occurred during that time, second is a duplicate
  private readonly maxDisplayedErrorCount = 4;
  private displayedErrorCount = 0;

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
    if (this.isDuplicate(message) || this.displayedErrorCount >= this.maxDisplayedErrorCount) {
      // We display message in console
      console.log('Hidden error message: "' + message + '"');
    } else {
      this.displayedErrorCount++;
      this.toast.error(message, {
        duration: 0,
        onDismiss: () => {
          this.displayedErrorCount--;
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

  //
  // Private
  //

  private isDuplicate(message: string): boolean {
    let result: boolean;
    const tid = this.timers.get(message);
    if (tid !== undefined) {
      // message is a duplicate
      result = true;
      clearTimeout(tid);
    } else {
      result = false;
    }
    const newTID = window.setTimeout(() => {
      this.timers.delete(message);
    }, this.duplicateTimeout);
    this.timers.set(message, newTID);
    return result;
  }
}
