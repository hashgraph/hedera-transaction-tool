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
}>();

/* State */
const gossipIpAddressV4 = ref('');
const serviceIpAddressV4 = ref('');
const gossipPort = ref('');
const servicePort = ref('');
const gossipDomainName = ref('');
const serviceDomainName = ref('');

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: NodeData): void;
}>();

/* Handlers */
function handleAddGossipEndpoint() {
  if (gossipIpAddressV4.value && gossipDomainName.value) {
    throw new Error('Either IP Address or Domain Name can be entered, but not both');
  }

  emit('update:data', {
    ...props.data,
    gossipEndpoints: [
      ...props.data.gossipEndpoints,
      getEndpointData(gossipIpAddressV4.value, gossipPort.value, gossipDomainName.value),
    ],
  });
  gossipIpAddressV4.value = '';
  gossipPort.value = '';
  gossipDomainName.value = '';
}

function handleAddServiceEndpoint() {
  if (serviceIpAddressV4.value && serviceDomainName.value) {
    throw new Error('Either IP Address or Domain Name can be entered, but not both');
  }
  emit('update:data', {
    ...props.data,
    serviceEndpoints: [
      ...props.data.serviceEndpoints,
      getEndpointData(serviceIpAddressV4.value, servicePort.value, serviceDomainName.value),
    ],
  });
  serviceIpAddressV4.value = '';
  servicePort.value = '';
  serviceDomainName.value = '';
}

/* Functions */
function getEndpointData(ipAddressV4: string, port: string, domainName: string) {
  const domainNameTrimmed = domainName.trim();
  return {
    ipAddressV4,
    port: domainNameTrimmed ? '' : port,
    domainName: domainNameTrimmed,
  };
}

function formatOctets(value: string) {
  const octets = value.split('.');

  const newOctets = octets.map(octet => {
    if (octet === '') {
      return '';
    }
    const n = Number.parseInt(octet);
    if (!isNaN(n) && n >= 0 && n <= 255) {
      return n.toString();
    } else {
      return n.toString().slice(0, 3);
    }
  });

  if (newOctets.length > 4) {
    newOctets.pop();
  }

  if (newOctets.length <= 4) {
    return newOctets.join('.');
  }

  return null;
}

function formatPort(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function formatServiceIpAddress(event: Event) {
  const target = event.target as HTMLInputElement;
  const octets = formatOctets(target.value);
  if (octets) {
    serviceIpAddressV4.value = octets;
  }
}

function formatGossipIpAddress(event: Event) {
  const target = event.target as HTMLInputElement;
  const octets = formatOctets(target.value);
  if (octets) {
    gossipIpAddressV4.value = octets;
  }
}

function formatGossipPort(event: Event) {
  const target = event.target as HTMLInputElement;
  gossipPort.value = formatPort(target.value);
}

function formatServicePort(event: Event) {
  const target = event.target as HTMLInputElement;
  servicePort.value = formatPort(target.value);
}

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="form-group mt-6" :class="[columnClass]">
    <label class="form-label">Node Account ID <span class="text-danger">*</span></label>
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
  <div class="form-group mt-6" :class="[columnClass]">
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

  <label class="form-label">Gossip Endpoints <span class="text-danger">*</span></label>
  <div class="d-flex">
    <div class="col">
      <label class="form-label">IP Address</label>
      <input
        v-model="gossipIpAddressV4"
        @input="formatGossipIpAddress"
        class="form-control is-fill"
        placeholder="Enter IP Address"
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
    <div class="col mx-5">
      <label class="form-label">Domain Name</label>
      <AppInput
        v-model:model-value="gossipDomainName"
        :filled="true"
        placeholder="Enter Domain Name"
      />
    </div>
    <AppButton color="primary" type="button" class="align-self-end" @click="handleAddGossipEndpoint"
      >Add Gossip Endpoint
    </AppButton>
  </div>

  <ul class="mt-5">
    <li class="d-flex">
      <label class="form-label col text-center">IP Address</label>
      <label class="form-label mx-5 col text-center">Port</label>
      <label class="form-label col text-center">Domain Name</label>
    </li>
    <li v-for="(endpoint, index) of data.gossipEndpoints" :key="index" class="d-flex">
      <div class="col text-center">{{ endpoint.ipAddressV4 }}</div>
      <div class="col text-center">{{ endpoint.port }}</div>
      <div class="col text-center">{{ endpoint.domainName }}</div>
    </li>
  </ul>

  <hr class="separator my-5" />

  <label class="form-label">Service Endpoints <span class="text-danger">*</span></label>
  <div class="d-flex">
    <div class="col">
      <label class="form-label">IP Address</label>
      <input
        v-model="serviceIpAddressV4"
        @input="formatServiceIpAddress"
        class="form-control is-fill"
        placeholder="Enter IP Address"
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
    <div class="col mx-5">
      <label class="form-label">Domain Name</label>
      <AppInput
        v-model:model-value="serviceDomainName"
        :filled="true"
        placeholder="Enter Domain Name"
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
      <label class="form-label col text-center">IP Address</label>
      <label class="form-label mx-5 col text-center">Port</label>
      <label class="form-label col text-center">Domain Name</label>
    </li>
    <li v-for="(endpoint, index) of data.serviceEndpoints" :key="index" class="d-flex">
      <div class="col text-center">{{ endpoint.ipAddressV4 }}</div>
      <div class="col text-center">{{ endpoint.port }}</div>
      <div class="col text-center">{{ endpoint.domainName }}</div>
    </li>
  </ul>

  <hr class="separator my-5" />

  <div class="form-group" :class="[columnClass]">
    <label class="form-label">Gossip CA Certificate <span class="text-danger">*</span></label>
    <AppInput
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
      is-required
    />
  </div>
</template>
