<script setup lang="ts">
import type {
  ComponentRegisteredServiceEndpoint,
  RegisteredEndpointType,
  RegisteredNodeData,
} from '@renderer/utils/sdk';

import { computed, ref } from 'vue';

import { utf8ByteLength } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';
import KeyField from '@renderer/components/KeyField.vue';
import EndpointRow from './EndpointRow.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import IpDomainInput from '@renderer/components/IpDomainInput.vue';
import { InputStatus } from '@renderer/components/InputStatus';
import { RegisteredNodeTypeLabel } from '@renderer/components/Transaction/Create/RegisteredNodeCreate/RegisteredNodeTypeLabel';
import PortInput from '@renderer/components/PortInput.vue';
import BlockNodeApiOptions from '@renderer/components/Transaction/Create/RegisteredNodeCreate/BlockNodeApiOptions.vue';

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

/* State */
const endpointType = ref<RegisteredEndpointType>('blockNode');
const ipOrDomain = ref<string | Uint8Array | null>(null);
const ipOrDomainStatus = ref<InputStatus>(InputStatus.empty);
const port = ref<number | null>(null);
const portStatus = ref<InputStatus>(InputStatus.empty);
const requiresTls = ref<boolean>(false);
const blockNodeApiOptions = ref<number[]>([]);
const endpointDescription = ref<string>('');

/* Computed */
const descriptionByteLength = computed(() => utf8ByteLength(props.data.description ?? ''));
const isDescriptionTooLong = computed(() => descriptionByteLength.value > DESCRIPTION_MAX_BYTES);
const addEndPointEnabled = computed(() => {
  return ipOrDomain.value !== null && port.value !== null;
});

/* Handlers */
function handleAddEndpoint() {
  // No `uiId` here — the parent's `decorateEndpointsWithUiIds` (in
  // RegisteredNodeCreate.vue) is the single owner of uiId generation. That
  // keeps uiId out of `getRegisteredNodeData`'s output, which keeps
  // `transactionsDataMatch` deterministic across reloads.
  const newItem: ComponentRegisteredServiceEndpoint = {
    type: endpointType.value,
    ipAddressV4: ipOrDomain.value instanceof Uint8Array ? ipOrDomain.value.join('.') : null,
    domainName: typeof ipOrDomain.value === 'string' ? ipOrDomain.value : null,
    port: port.value !== null ? port.value.toString() : '',
    requiresTls: requiresTls.value,
    endpointApis: endpointType.value === 'blockNode' ? blockNodeApiOptions.value : undefined,
    endpointDescription:
      endpointType.value === 'generalService' ? endpointDescription.value : undefined,
  };

  emit('update:data', {
    ...props.data,
    serviceEndpoints: [...props.data.serviceEndpoints, newItem],
  });

  // Keeps endPointType unchanged
  ipOrDomain.value = null;
  port.value = null;
  requiresTls.value = false;
  blockNodeApiOptions.value = [];
  endpointDescription.value = '';
}

function handleDeleteEndpoint(index: number) {
  const next = [...props.data.serviceEndpoints];
  next.splice(index, 1);
  emit('update:data', { ...props.data, serviceEndpoints: next });
}
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
      {{ descriptionByteLength }} / {{ DESCRIPTION_MAX_BYTES
      }}{{ isDescriptionTooLong ? ' - too long' : '' }}
    </div>
  </div>

  <!-- Service Endpoints -->
  <div class="form-group mt-6 col-12 col-xxxl-6">
    <label class="form-label">
      Service Endpoints
      <span v-if="required" class="text-danger">*</span>
    </label>
    <div class="border rounded mt-1 p-4">
      <div class="row align-items-end flex-nowrap">
        <!-- Type -->
        <div class="col-2">
          <label class="form-label">Type</label>
          <select
            class="form-control is-fill"
            v-model="endpointType"
            data-testid="select-registered-endpoint-type"
          >
            <option v-for="opt in Object.keys(RegisteredNodeTypeLabel)" :key="opt" :value="opt">
              {{ RegisteredNodeTypeLabel[opt as RegisteredEndpointType] }}
            </option>
          </select>
        </div>
        <!-- IP/Domain -->
        <div class="col-5">
          <label class="form-label">IP/Domain <span class="text-danger">*</span></label>
          <IpDomainInput
            v-model="ipOrDomain"
            @status="ipOrDomainStatus = $event"
            data-testid="input-registered-endpoint-address"
          />
        </div>
        <!-- Port -->
        <div class="col-2">
          <label class="form-label">Port <span class="text-danger">*</span></label>
          <PortInput
            v-model="port"
            @status="portStatus = $event"
            data-testid="input-registered-endpoint-port"
          />
        </div>
        <!-- TLS -->
        <div class="col-auto">
          <label class="form-label">TLS</label>
          <AppSwitch
            v-model:checked="requiresTls"
            size="md"
            name="registered-endpoint-tls"
            data-testid="switch-registered-endpoint-tls"
          />
        </div>
        <!-- Add Endpoint -->
        <div class="col-auto">
          <AppButton
            color="primary"
            type="button"
            :disabled="!addEndPointEnabled"
            @click="handleAddEndpoint"
            data-testid="button-add-registered-endpoint"
          >
            Add Endpoint
          </AppButton>
        </div>
      </div>
      <div class="row align-items-end flex-nowrap">
        <!-- Block Node API options -->
        <div v-if="endpointType === 'blockNode'" class="form-group mt-4">
          <label class="form-label">Block Node APIs</label>
          <BlockNodeApiOptions v-model="blockNodeApiOptions" />
        </div>
        <!-- General service description -->
        <div v-else-if="endpointType === 'generalService'" class="form-group mt-4">
          <label class="form-label">Description</label>
          <AppTextArea
            v-model="endpointDescription"
            :filled="true"
            placeholder="Describe what this general-service endpoint provides"
            data-testid="textarea-registered-endpoint-general-desc"
          />
        </div>
      </div>
      <table class="table-custom mt-5">
        <thead class="thin">
          <tr>
            <th class="text-start">Type</th>
            <th class="text-start">IP/Domain</th>
            <th class="text-start">Port</th>
            <th class="text-start">TLS</th>
            <th class="text-start">APIs/Description</th>
            <th class="text-end">Action</th>
          </tr>
        </thead>
        <tbody class="thin">
          <template v-if="data.serviceEndpoints.length == 0">
            <tr>
              <td class="col text-center" colspan="6">
                <span class="text-secondary">
                  No service endpoint.<br />At least one item must be added.
                </span>
              </td>
            </tr>
          </template>
          <template v-else>
            <template v-for="(endpoint, index) in data.serviceEndpoints" :key="endpoint.uiId">
              <EndpointRow
                :endpoint="endpoint"
                :index="index"
                @delete="handleDeleteEndpoint(index)"
              />
            </template>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
</style>
