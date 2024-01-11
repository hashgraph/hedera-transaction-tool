import { onBeforeUnmount, onMounted } from 'vue';

import Tooltip from 'bootstrap/js/dist/tooltip';

export default function useCreateTooltips() {
  onMounted(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    Array.from(tooltipTriggerList).map(tooltipTriggerEl => new Tooltip(tooltipTriggerEl));
  });

  onBeforeUnmount(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(
      tooltipTriggerEl => Tooltip.getInstance(tooltipTriggerEl)?.dispose(),
    );
  });
}
