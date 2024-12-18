import type { Directive } from 'vue';
import { nextTick } from 'vue';

export const AutoFocusFirstInputDirective: Directive = {
  mounted(el) {
    const focus = () => {
      const firstElement = el.querySelector('input, textarea, select') as HTMLElement | null;
      if (firstElement) {
        firstElement.focus();
      }
    };
    nextTick(() => focus());
  },
};

export const focusFirstInput = (container: HTMLElement | null): void => {
  nextTick(() => {
    const firstElement = container?.querySelector('input, textarea, select') as HTMLElement | null;
    if (firstElement) {
      firstElement.focus();
    }
  });
};
