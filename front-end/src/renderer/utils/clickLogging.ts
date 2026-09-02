import type { Directive, DirectiveBinding } from 'vue';

import { createLogger } from './logger';

const logger = createLogger('renderer.ui-clicks');

export type ClickLogValue = string | { label: string; metadata?: Record<string, unknown> };

interface ClickLogElement extends HTMLElement {
  __clickLogBinding__?: DirectiveBinding<ClickLogValue | undefined>;
  __clickLogListener__?: () => void;
}

function toLogPayload(el: HTMLElement, value: ClickLogValue | undefined) {
  if (value === undefined) {
    // No value bound - fall back to the element's own text as the label. Handy for blanket
    // instrumentation (e.g. on a shared base button) without annotating every usage site.
    return { label: el.textContent?.trim() || el.tagName.toLowerCase() };
  }

  return typeof value === 'string'
    ? { label: value }
    : { label: value.label, metadata: value.metadata };
}

/**
 * Logs a click on the bound element via the renderer logger, e.g.:
 *   v-log-click
 *   v-log-click="'submit-transaction'"
 *   v-log-click="{ label: 'submit-transaction', metadata: { transactionId } }"
 *
 * Attached in `created` rather than `mounted`. Vue applies an element's own attrs/listeners
 * (e.g. @click) *before* invoking `mounted`, so a listener added there always runs after the
 * element's own click handler - including any of that handler's side effects (e.g. removing
 * the clicked row from a v-for list), which can detach this listener before it's invoked.
 * `created` fires before attrs are applied, so this listener registers - and therefore runs -
 * first, regardless of what the element's own click handler does afterward.
 */
export const ClickLoggingDirective: Directive<HTMLElement, ClickLogValue | undefined> = {
  created(el: ClickLogElement, binding) {
    el.__clickLogBinding__ = binding;
    el.__clickLogListener__ = () => {
      const current = el.__clickLogBinding__;
      logger.info('click', toLogPayload(el, current?.value));
    };
    el.addEventListener('click', el.__clickLogListener__);
  },
  updated(el: ClickLogElement, binding) {
    el.__clickLogBinding__ = binding;
  },
  unmounted(el: ClickLogElement) {
    if (el.__clickLogListener__) {
      el.removeEventListener('click', el.__clickLogListener__);
      delete el.__clickLogListener__;
      delete el.__clickLogBinding__;
    }
  },
};
