<script setup lang="ts">
import type { NodeData } from '@renderer/utils/sdk';

import { ref, useTemplateRef } from 'vue';

import { formatAccountId } from '@renderer/utils';
import { sha384, x509BytesFromPem } from '@renderer/services/electronUtilsService';

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
const publicKeyHash = ref('');
const hash = ref('');
const grpcCertificate = ref('');
const gossipCaCertificate = ref('');
const gossipInput = useTemplateRef('gossipInput');
const grpcInput = ref<HTMLInputElement | null>(null);
const gossipFile = ref<HTMLInputElement | null>(null);
const grpcFile = ref<HTMLInputElement | null>(null);

const validIp =
  '^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$';

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: NodeData): void;
}>();

/* Handlers */
function handleAddEndpoint(key: 'gossip' | 'service') {
  const variableMapping = {
    gossip: {
      ipOrDomain: gossipIpOrDomain,
      port: gossipPort,
      endpoints: props.data.gossipEndpoints,
      key: 'gossipEndpoints',
    },
    service: {
      ipOrDomain: serviceIpOrDomain,
      port: servicePort,
      endpoints: props.data.serviceEndpoints,
      key: 'serviceEndpoints',
    },
  };

  if (!variableMapping[key].ipOrDomain.value.trim() || !variableMapping[key].port.value.trim())
    return;

  emit('update:data', {
    ...props.data,
    [variableMapping[key].key]: [
      ...variableMapping[key].endpoints,
      getEndpointData(variableMapping[key].ipOrDomain.value, variableMapping[key].port.value),
    ],
  });

  variableMapping[key].ipOrDomain.value = '';
  variableMapping[key].port.value = '';
}

function handleDeleteEndpoint(index: number, key: 'gossipEndpoints' | 'serviceEndpoints') {
  const endpoints = props.data[key];

  endpoints.splice(index, 1);
  emit('update:data', {
    ...props.data,
    [key]: endpoints,
  });
}

async function handleInputGossipCert(e: Event) {
  const target = e.target as HTMLInputElement;
  await handleUpdateGossipCert(target.value);
}

async function handleUpdateGossipCert(str: string) {
  const publicKey = str.split('-----')[2];
  if (!str) {
    publicKeyHash.value = '';
  } else {
    publicKeyHash.value = await sha384(publicKey);
  }
  emit('update:data', {
    ...props.data,
    gossipCaCertificate: await x509BytesFromPem(str),
  });
}

async function handleInputGrpcCert(e: Event) {
  const target = e.target as HTMLInputElement;
  await handleUpdateGrpcCert(target.value);
}

async function handleUpdateGrpcCert(str: string) {
  if (!str) {
    hash.value = '';
  } else if (!str.endsWith('\n')) {
    hash.value = await sha384(str + '\n');
  } else {
    hash.value = await sha384(str);
  }
  emit('update:data', {
    ...props.data,
    certificateHash: hash.value,
  });
}

function handleOnImportGossipClick() {
  if (gossipFile.value != null) {
    gossipFile.value.click();
  }
}

async function handleOnGossipFileChanged(e: Event) {
  const reader = new FileReader();
  const target = e.target as HTMLInputElement;
  reader.readAsText(target.files![0]);
  reader.onload = () => {
    gossipCaCertificate.value = reader.result as string;
    void handleUpdateGossipCert(gossipCaCertificate.value);
  };

  if (gossipFile.value != null) {
    gossipFile.value.value = '';
  }
}

function handleOnImportGrpcClick() {
  if (grpcFile.value != null) {
    grpcFile.value.click();
  }
}

async function handleOnGrpcFileChanged(e: Event) {
  const reader = new FileReader();
  const target = e.target as HTMLInputElement;
  reader.readAsText(target.files![0]);
  reader.onload = () => {
    grpcCertificate.value = reader.result as string;
    void handleUpdateGrpcCert(grpcCertificate.value);
  };

  if (grpcFile.value != null) {
    grpcFile.value.value = '';
  }
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

function formatPort(event: Event, key: 'gossip' | 'service') {
  const portMapping = {
    gossip: gossipPort,
    service: servicePort,
  };
  const target = event.target as HTMLInputElement;
  portMapping[key].value = target.value.replace(/[^0-9]/g, '');
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
  <div class="row align-items-end">
    <div class="col-4 col-xxxl-3">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="gossipIpOrDomain"
        class="form-control is-fill"
        placeholder="Enter Domain Name or IP Address"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <label class="form-label">Port</label>
      <input
        v-model="gossipPort"
        @input="formatPort($event, 'gossip')"
        class="form-control is-fill"
        placeholder="Enter Port"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <AppButton color="primary" type="button" @click="handleAddEndpoint('gossip')">
        Add Gossip Endpoint
      </AppButton>
    </div>
  </div>

  <div v-if="data.gossipEndpoints.length > 0" class="mt-5">
    <div class="row">
      <div class="col-4 col-xxxl-3">
        <label class="form-label">IP/Domain</label>
      </div>

      <div class="col-4 col-xxxl-3">
        <label class="form-label">Port</label>
      </div>

      <div class="col-4 col-xxxl-3 text-center">
        <label class="form-label">Action</label>
      </div>
    </div>

    <div class="row">
      <div class="col-12 col-xxxl-9">
        <hr class="separator mb-3" />
      </div>
    </div>

    <div v-for="(endpoint, index) of data.gossipEndpoints" :key="index" class="row py-3">
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">
        {{ endpoint.ipAddressV4 ? endpoint.ipAddressV4 : endpoint.domainName }}
      </div>
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">{{ endpoint.port }}</div>
      <div class="col-4 col-xxxl-3 d-flex justify-content-center">
        <AppButton
          type="button"
          color="danger"
          class="col-1"
          @click="handleDeleteEndpoint(index, 'gossipEndpoints')"
          >Delete
        </AppButton>
      </div>
    </div>
  </div>

  <hr class="separator my-5" />

  <label class="form-label"
    >Service Endpoints <span v-if="required" class="text-danger">*</span></label
  >
  <div class="row align-items-end">
    <div class="col-4 col-xxxl-3">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="serviceIpOrDomain"
        class="form-control is-fill"
        placeholder="Enter Domain Name or IP Address"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <label class="form-label">Port</label>
      <input
        v-model="servicePort"
        @input="formatPort($event, 'service')"
        class="form-control is-fill"
        placeholder="Enter Port"
      />
    </div>

    <div class="col-4 col-xxxl-3">
      <AppButton color="primary" type="button" @click="handleAddEndpoint('service')"
        >Add Service Endpoint
      </AppButton>
    </div>
  </div>

  <div v-if="data.serviceEndpoints.length > 0" class="mt-5">
    <div class="row">
      <div class="col-4 col-xxxl-3">
        <label class="form-label">IP/Domain</label>
      </div>
      <div class="col-4 col-xxxl-3">
        <label class="form-label">Port</label>
      </div>
      <div class="col-4 col-xxxl-3 text-center">
        <label class="form-label">Action</label>
      </div>
    </div>

    <div class="row">
      <div class="col-12 col-xxxl-9">
        <hr class="separator mb-3" />
      </div>
    </div>

    <div v-for="(endpoint, index) of data.serviceEndpoints" :key="index" class="row py-3">
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">
        {{ endpoint.ipAddressV4 ? endpoint.ipAddressV4 : endpoint.domainName }}
      </div>
      <div class="col-4 col-xxxl-3 d-flex align-items-center text-small">{{ endpoint.port }}</div>
      <div class="col-4 col-xxxl-3 d-flex justify-content-center">
        <AppButton
          type="button"
          color="danger"
          class="col-1"
          @click="handleDeleteEndpoint(index, 'serviceEndpoints')"
          >Delete
        </AppButton>
      </div>
    </div>
  </div>

  <hr class="separator my-5" />

  <div class="form-group" :class="['col-8 col-xxxl-6']">
    <div class="d-flex align-items-center mb-3">
      <label class="form-label mb-0"
        >Gossip CA Certificate <span v-if="required" class="text-danger">*</span></label
      >
      <input type="file" accept=".pem" ref="gossipFile" @change="handleOnGossipFileChanged" />
      <AppButton type="button" color="primary" class="ms-5" @click="handleOnImportGossipClick">
        Upload Pem
      </AppButton>
    </div>
    <AppTextArea
      :model-value="gossipCaCertificate"
      ref="gossipInput"
      @input="handleInputGossipCert"
      :filled="true"
      placeholder="Enter Gossip CA Certificate"
    />
  </div>

  <div class="form-group mt-6 col-8 col-xxxl-6">
    <label class="form-label">Public Key Hash</label>
    {{ publicKeyHash }}
  </div>

  <div class="form-group mt-6" :class="['col-8 col-xxxl-6']">
    <div class="d-flex align-items-center mb-3">
      <label class="form-label mb-0">GRPC Certificate</label>
      <input type="file" accept=".pem" ref="grpcFile" @change="handleOnGrpcFileChanged" />
      <AppButton type="button" color="primary" class="ms-5" @click="handleOnImportGrpcClick">
        Upload Pem
      </AppButton>
    </div>
    <AppTextArea
      :model-value="grpcCertificate"
      ref="grpcInput"
      @input="handleInputGrpcCert"
      :filled="true"
      placeholder="Enter GRPC Certificate"
    />
  </div>

  <div class="form-group mt-6 col-8 col-xxxl-6">
    <label class="form-label">Certificate Hash</label>
    {{ data.certificateHash }}
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
