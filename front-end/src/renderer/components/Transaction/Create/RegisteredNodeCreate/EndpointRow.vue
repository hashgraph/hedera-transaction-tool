<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRegisteredServiceEndpoint } from '@renderer/utils/sdk';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { RegisteredNodeTypeLabel } from './RegisteredNodeTypeLabel';
import { labelForBlockNodeApi } from "./BlockNodeApiLabel";

/* Props */
const props = defineProps<{
  endpoint: ComponentRegisteredServiceEndpoint;
  index: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'delete'): void;
}>();

/* Computed */
const endpointType = computed(
  () => RegisteredNodeTypeLabel[props.endpoint.type] ?? props.endpoint.type,
);
const ipOrDomain = computed(() => {
  let result: string;
  if (props.endpoint.ipAddressV4 !== null && props.endpoint.ipAddressV4 !== '') {
    result = props.endpoint.ipAddressV4;
  } else if (props.endpoint.domainName !== null && props.endpoint.domainName !== '') {
    result = props.endpoint.domainName;
  } else {
    result = '';
  }
  return result;
});
const endpointInfo = computed(() => {
  let result: string;
  switch (props.endpoint.type) {
    case 'blockNode':
      result = blockNodeAPIs.value;
      break;
    case 'mirrorNode':
    case 'rpcRelay':
      result = '';
      break;
    case 'generalService':
      result = props.endpoint.endpointDescription ?? '';
      break;
    default:
      result = '?';
      break;
  }
  return result;
});
const blockNodeAPIs = computed(() => {
  let result: string;
  const apis = props.endpoint.endpointApis;
  if (apis) {
    result = apis.map(api => labelForBlockNodeApi(api)).join(',');
  } else {
    result = 'No API';
  }
  return result;
});

/* Others */
</script>

<template>
  <tr>
    <td class="col text-start">{{ endpointType }}</td>
    <td class="col text-start">{{ ipOrDomain }}</td>
    <td class="col text-start">{{ props.endpoint.port }}</td>
    <td class="col text-start">{{ props.endpoint.requiresTls ? 'Yes' : 'No' }}</td>
    <td class="col text-start">{{ endpointInfo }}</td>
    <td class="col text-end">
      <AppButton
        type="button"
        color="danger"
        :data-testid="`button-delete-registered-endpoint-${index}`"
        @click="emit('delete')"
        >Delete</AppButton
      >
    </td>
  </tr>
</template>
