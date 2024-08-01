import { onBeforeUnmount, onMounted } from 'vue';

import Tooltip from 'bootstrap/js/dist/tooltip';

let list: Element[] = [];

export default function useCreateTooltips() {
  onMounted(() => {
    create();
  });

  onBeforeUnmount(() => {
    list
      .concat(Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]')))
      .forEach(tooltipTriggerEl => removeStuckTooltip(tooltipTriggerEl as HTMLElement));
  });

  function create() {
    list?.forEach(tooltipTriggerEl => removeStuckTooltip(tooltipTriggerEl as HTMLElement));

    list = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    Array.from(list).map(
      tooltipTriggerEl =>
        new Tooltip(tooltipTriggerEl, {
          trigger: 'hover',
        }),
    );
  }

  return create;
}

export function removeStuckTooltip(e: HTMLElement) {
  const tooltip = Tooltip.getInstance(e);
  const tooltipId = e.getAttribute('aria-describedby');

  if (tooltipId) {
    const tooltipElement = document.getElementById(tooltipId);
    tooltipElement?.remove();
  }

  if (tooltip) {
    tooltip.hide();
  }
}

export function clearTooltips() {
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(tooltipTriggerEl =>
    removeStuckTooltip(tooltipTriggerEl as HTMLElement),
  );
}
