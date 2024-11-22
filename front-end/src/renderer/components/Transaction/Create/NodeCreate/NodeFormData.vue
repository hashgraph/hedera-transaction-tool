<script setup lang="ts">
import type { NodeData } from '@renderer/utils/sdk';

import { ref } from 'vue';

import { formatAccountId } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';
import KeyField from '@renderer/components/KeyField.vue';

/* Props */
const props = defineProps<{
  data: NodeData;
  required?: boolean;
}>();

/* State */
const gossipIpOrDomain = ref('');
const serviceIpOrDomain = ref('');
const gossipPort = ref('');
const servicePort = ref('');

const validIp =
  '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$';

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: NodeData): void;
}>();

/* Handlers */
function handleAddGossipEndpoint() {
  emit('update:data', {
    ...props.data,
    gossipEndpoints: [
      ...props.data.gossipEndpoints,
      getEndpointData(gossipIpOrDomain.value, gossipPort.value),
    ],
  });
  gossipIpOrDomain.value = '';
  gossipPort.value = '';
}

function handleAddServiceEndpoint() {
  emit('update:data', {
    ...props.data,
    serviceEndpoints: [
      ...props.data.serviceEndpoints,
      getEndpointData(serviceIpOrDomain.value, servicePort.value),
    ],
  });
  serviceIpOrDomain.value = '';
  servicePort.value = '';
}

/* Functions */
function getEndpointData(ipOrDomain: string, port: string) {
  let ip = '';
  let domain = '';

  if (ipOrDomain.match(validIp)) {
    ip = ipOrDomain;
  } else {
    domain = ipOrDomain;
  }

  return {
    ipAddressV4: ip,
    port,
    domainName: domain.trim(),
  };
}

function formatPort(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function formatGossipPort(event: Event) {
  const target = event.target as HTMLInputElement;
  gossipPort.value = formatPort(target.value);
}

function formatServicePort(event: Event) {
  const target = event.target as HTMLInputElement;
  servicePort.value = formatPort(target.value);
}
</script>
<template>
  <div class="form-group mt-6" :class="['col-4 col-xxxl-3']">
    <label class="form-label"
      >Node Account ID <span v-if="required" class="text-danger">*</span></label
    >
    <AppInput
      :model-value="data.nodeAccountId?.toString()"
      @update:model-value="
        emit('update:data', {
          ...data,
          nodeAccountId: formatAccountId($event),
        })
      "
      :filled="true"
      placeholder="Enter Node Account ID"
    />
  </div>
  <div class="form-group mt-6" :class="['col-4 col-xxxl-3']">
    <label class="form-label">Node Description</label>
    <AppInput
      :model-value="data.description"
      @update:model-value="
        emit('update:data', {
          ...data,
          description: $event,
        })
      "
      :filled="true"
      placeholder="Enter Node Description"
    />
  </div>

  <hr class="separator my-5" />

  <label class="form-label"
    >Gossip Endpoints <span v-if="required" class="text-danger">*</span></label
  >
  <div class="d-flex">
    <div class="col">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="gossipIpOrDomain"
        class="form-control is-fill"
        placeholder="Enter Domain Name or IP Address"
      />
    </div>
    <div class="mx-5 col-2">
      <label class="form-label">Port</label>
      <input
        v-model="gossipPort"
        @input="formatGossipPort"
        class="form-control is-fill"
        placeholder="Enter Port"
      />
    </div>
    <AppButton color="primary" type="button" class="align-self-end" @click="handleAddGossipEndpoint"
      >Add Gossip Endpoint
    </AppButton>
  </div>

  <ul class="mt-5">
    <li class="d-flex">
      <label class="form-label col text-center">IP/Domain</label>
      <label class="form-label mx-5 col text-center">Port</label>
    </li>
    <li v-for="(endpoint, index) of data.gossipEndpoints" :key="index" class="d-flex">
      <div class="col text-center">
        {{ endpoint.ipAddressV4 ? endpoint.ipAddressV4 : endpoint.domainName }}
      </div>
      <div class="col text-center">{{ endpoint.port }}</div>
    </li>
  </ul>

  <hr class="separator my-5" />

  <label class="form-label"
    >Service Endpoints <span v-if="required" class="text-danger">*</span></label
  >
  <div class="d-flex">
    <div class="col">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="serviceIpOrDomain"
        class="form-control is-fill"
        placeholder="Enter Domain Name or IP Address"
      />
    </div>
    <div class="mx-5 col-2">
      <label class="form-label">Port</label>
      <input
        v-model="servicePort"
        @input="formatServicePort"
        class="form-control is-fill"
        placeholder="Enter Port"
      />
    </div>
    <AppButton
      color="primary"
      type="button"
      class="align-self-end"
      @click="handleAddServiceEndpoint"
      >Add Service Endpoint
    </AppButton>
  </div>

  <ul class="mt-5">
    <li class="d-flex">
      <label class="form-label col text-center">IP/Domain</label>
      <label class="form-label mx-5 col text-center">Port</label>
    </li>
    <li v-for="(endpoint, index) of data.serviceEndpoints" :key="index" class="d-flex">
      <div class="col text-center">
        {{ endpoint.ipAddressV4 ? endpoint.ipAddressV4 : endpoint.domainName }}
      </div>
      <div class="col text-center">{{ endpoint.port }}</div>
    </li>
  </ul>

  <hr class="separator my-5" />

  <div class="form-group" :class="['col-8 col-xxxl-6']">
    <label class="form-label"
      >Gossip CA Certificate <span v-if="required" class="text-danger">*</span></label
    >
    <AppTextArea
      :model-value="data.gossipCaCertificate"
      @update:model-value="
        emit('update:data', {
          ...data,
          gossipCaCertificate: $event.startsWith('0x') ? $event.slice(2) : $event,
        })
      "
      :filled="true"
      placeholder="Enter Gossip CA Certificate"
    />
  </div>

  <div class="form-group mt-6" :class="['col-8 col-xxxl-6']">
    <label class="form-label">GRPC Certificate Hash</label>
    <AppTextArea
      :model-value="data.certificateHash"
      @update:model-value="
        emit('update:data', {
          ...data,
          certificateHash: $event,
        })
      "
      :filled="true"
      placeholder="Enter GRPC Certificate Hash"
    />
  </div>

  <hr class="separator my-5" />

  <div class="form-group col-8 col-xxxl-6">
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
</template>
