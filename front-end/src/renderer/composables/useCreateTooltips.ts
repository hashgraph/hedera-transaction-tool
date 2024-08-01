import { onBeforeUnmount, onMounted } from 'vue';

import Tooltip from 'bootstrap/js/dist/tooltip';

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

export default function useCreateTooltips() {
  onMounted(() => {
    create();
  });

  onBeforeUnmount(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(tooltipTriggerEl => Tooltip.getInstance(tooltipTriggerEl)?.hide());
  });

  function create() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    Array.from(tooltipTriggerList).map(
      tooltipTriggerEl =>
        new Tooltip(tooltipTriggerEl, {
          trigger: 'hover',
        }),
    );
  }

  return create;
}
