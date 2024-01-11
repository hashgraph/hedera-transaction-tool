import { onBeforeUnmount, onMounted } from 'vue';

import Tooltip from 'bootstrap/js/dist/tooltip';

export default function useCreateTooltips() {
  onMounted(() => {
    create();
  });

  onBeforeUnmount(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(
      tooltipTriggerEl => Tooltip.getInstance(tooltipTriggerEl)?.dispose(),
    );
  });

  function create() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    Array.from(tooltipTriggerList).map(tooltipTriggerEl => new Tooltip(tooltipTriggerEl));
  }

  return create;
}
