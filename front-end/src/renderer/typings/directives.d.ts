import type { Directive } from 'vue';

import type { ClickLogValue } from '@renderer/utils/clickLogging';

declare module '@vue/runtime-core' {
  interface GlobalDirectives {
    vFocusFirstInput: Directive;
    vLogClick: Directive<HTMLElement, ClickLogValue | undefined>;
  }
}
