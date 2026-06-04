<script setup lang="ts">
import type {
  ComponentRegisteredServiceEndpoint,
  RegisteredEndpointType,
  RegisteredNodeData,
} from '@renderer/utils/sdk';

import { computed } from 'vue';

import { utf8ByteLength } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import KeyField from '@renderer/components/KeyField.vue';
import EndpointRow from './EndpointRow.vue';

/* Props */
const props = defineProps<{
  data: RegisteredNodeData;
  required?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: RegisteredNodeData): void;
}>();

/* Constants */
const DESCRIPTION_MAX_BYTES = 100;

/* Computed */
const descriptionByteLength = computed(() => utf8ByteLength(props.data.description ?? ''));
const isDescriptionTooLong = computed(() => descriptionByteLength.value > DESCRIPTION_MAX_BYTES);

/* Handlers */
function handleAddEndpoint() {
  // No `uiId` here — the parent's `decorateEndpointsWithUiIds` (in
  // RegisteredNodeCreate.vue) is the single owner of uiId generation. That
  // keeps uiId out of `getRegisteredNodeData`'s output, which keeps
  // `transactionsDataMatch` deterministic across reloads.
  const blank: ComponentRegisteredServiceEndpoint = {
    type: 'blockNode',
    ipAddressV4: '',
    domainName: '',
    port: '',
    requiresTls: false,
    endpointApis: [],
  };

  emit('update:data', {
    ...props.data,
    serviceEndpoints: [...props.data.serviceEndpoints, blank],
  });
}

function handleUpdateEndpoint(index: number, endpoint: ComponentRegisteredServiceEndpoint) {
  const next = [...props.data.serviceEndpoints];
  next[index] = endpoint;
  emit('update:data', { ...props.data, serviceEndpoints: next });
}

function handleDeleteEndpoint(index: number) {
  const next = [...props.data.serviceEndpoints];
  next.splice(index, 1);
  emit('update:data', { ...props.data, serviceEndpoints: next });
}

/** Stable row key — never `index`, since deleting/reordering with `index` keys
 * causes Vue to re-use DOM nodes from the wrong row (focus jumps, stale state).
 * Falls back gracefully if `uiId` is somehow missing (legacy drafts). */
function rowKey(endpoint: ComponentRegisteredServiceEndpoint, index: number): string {
  return endpoint.uiId ?? `legacy-${index}`;
}

/* Type helper for template */
const endpointTypeOptions: { value: RegisteredEndpointType; label: string }[] = [
  { value: 'blockNode', label: 'Block Node' },
  { value: 'mirrorNode', label: 'Mirror Node' },
  { value: 'rpcRelay', label: 'RPC Relay' },
  { value: 'generalService', label: 'General Service' },
];
</script>

<template>
  <!-- Admin Key -->
  <div class="form-group mt-6 col-8 col-xxxl-6">
    <KeyField
      label="Admin Key"
      :model-key="data.adminKey"
      @update:model-key="
        emit('update:data', {
          ...data,
          adminKey: $event,
        })
      "
      :is-required="required"
    />
  </div>

  <!-- Description -->
  <div class="form-group mt-6 col-8 col-xxxl-6">
    <label class="form-label">Registered Node Description</label>
    <AppInput
      :model-value="data.description"
      @update:model-value="
        emit('update:data', {
          ...data,
          description: $event,
        })
      "
      :filled="true"
      placeholder="Enter Description"
      :class="[isDescriptionTooLong ? 'is-invalid' : '']"
    />
    <div
      class="text-micro mt-1"
      :class="isDescriptionTooLong ? 'text-warning' : 'text-muted'"
      data-testid="text-registered-description-byte-counter"
    >
      {{ descriptionByteLength }} / {{ DESCRIPTION_MAX_BYTES }}{{ isDescriptionTooLong ? " - too long" : "" }}
    </div>
  </div>

  <hr class="separator my-5" />

  <!-- Service Endpoints -->
  <div class="d-flex align-items-center justify-content-between">
    <label class="form-label mb-0">
      Service Endpoints
      <span v-if="required" class="text-danger">*</span>
    </label>
    <AppButton
      color="primary"
      type="button"
      data-testid="button-add-registered-endpoint"
      :disabled="data.serviceEndpoints.length >= 50"
      @click="handleAddEndpoint"
    >
      Add Endpoint
    </AppButton>
  </div>
  <div class="text-micro text-muted mt-1 mb-3">
    At least one endpoint is required. A registered node may have up to 50 endpoints.
  </div>

  <div v-if="data.serviceEndpoints.length === 0" class="text-muted text-small">
    No endpoints added yet — click "Add Endpoint" to create one.
  </div>

  <EndpointRow
    v-for="(endpoint, index) in data.serviceEndpoints"
    :key="rowKey(endpoint, index)"
    :endpoint="endpoint"
    :index="index"
    :type-options="endpointTypeOptions"
    @update:endpoint="handleUpdateEndpoint(index, $event)"
    @delete="handleDeleteEndpoint(index)"
  />
</template>
