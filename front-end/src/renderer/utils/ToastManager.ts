import { inject, provide, ref } from 'vue';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.toastManager');

export class ToastManager {
  public static readonly injectKey = Symbol();

  public readonly entries = ref<ToastEntry[]>([]);
  private nextToastId = 0;

  private readonly maxDisplayedErrorCount = 4;
  private readonly duration = 4000;

  //
  // Public
  //

  public success(message: string) {
    this.addEntry(message, 'success');
  }

  public info(message: string) {
    this.addEntry(message, 'info');
  }

  public warning(message: string) {
    this.addEntry(message, 'warning');
  }

  public error(message: string) {
    if (
      this.findEntry(message, 'error') !== null ||
      this.countErrorEntries() >= this.maxDisplayedErrorCount
    ) {
      // We display message in console
      logger.debug('Hidden error message', { message });
    } else {
      this.addEntry(message, 'error');
    }
  }

  //
  // Public (static)
  //

  public static provide(toastManager: ToastManager): void {
    provide(ToastManager.injectKey, toastManager);
  }

  public static inject(): ToastManager {
    const defaultFactory = () => new ToastManager();
    return inject<ToastManager>(ToastManager.injectKey, defaultFactory, true);
  }

  //
  // Public (for ToastRenderer)
  //

  removeEntry(toastId: number) {
    const i = this.entries.value.findIndex(entry => entry.toastId === toastId);
    if (i !== -1) {
      this.entries.value.splice(i, 1);
    }
  }

  //
  // Public (for testing)
  //

  findEntry(message: string, toastType: ToastType): ToastEntry | null {
    return this.entries.value.find(e => e.message === message && e.type === toastType) ?? null;
  }

  countErrorEntries(): number {
    let result = 0;
    this.entries.value.forEach(e => {
      if (e.type === 'error') result += 1;
    });
    return result;
  }

  reset() {
    this.entries.value.splice(0)
  }

  //
  // Private
  //

  private addEntry(message: string, type: ToastType) {
    const newEntry = new ToastEntry(this.nextToastId++, message, type);
    this.entries.value.splice(0, 0, newEntry);
    if (type !== 'error') {
      setTimeout(() => this.removeEntry(newEntry.toastId), this.duration);
    } // else will be removed by ToastRenderer when closed by user
  }
}

type ToastType = 'success' | 'error' | 'warning' | 'info';

class ToastEntry {
  constructor(
    readonly toastId: number,
    readonly message: string,
    readonly type: ToastType,
  ) {}
}
