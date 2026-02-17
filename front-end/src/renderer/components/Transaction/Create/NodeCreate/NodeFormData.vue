<script setup lang="ts">
import type { NodeData } from '@renderer/utils/sdk';

import { ref, useTemplateRef, watch } from 'vue';

import { useToast } from 'vue-toast-notification';

import { sha384, x509BytesFromPem } from '@renderer/services/electronUtilsService';

import {
  formatAccountId,
  getErrorMessage,
  hexToUint8Array,
  safeAwait,
  uint8ToHex,
  validate100CharInput,
} from '@renderer/utils';

import {
  getEndpointData,
  isValidFqdn,
  processEndpointInput,
} from '@renderer/utils/endpointUtils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';
import KeyField from '@renderer/components/KeyField.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  data: NodeData;
  required?: boolean;
}>();

/* Composables */
const toast = useToast();

/* State */
const gossipIpOrDomain = ref('');
const serviceIpOrDomain = ref('');
const gossipPort = ref('');
const servicePort = ref('');
const grpcProxyDomain = ref('');
const grpcProxyPort = ref('');
const publicKeyHash = ref('');
const hash = ref('');
const grpcCertificate = ref('');
const gossipCaCertificateText = ref('');
const gossipFile = useTemplateRef<HTMLInputElement>('gossipFile');
const grpcFile = useTemplateRef<HTMLInputElement>('grpcFile');
const nodeDescriptionError = ref(false);

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

async function handleUpdateGossipCert(str: string) {
  let gossipCaCertificate = Uint8Array.from([]);
  publicKeyHash.value = '';

  if (str.trim().length !== 0) {
    const { data } = await safeAwait(x509BytesFromPem(str));

    if (data) {
      gossipCaCertificate = data.raw;
      publicKeyHash.value = data.hash;
    }
  }

  emit('update:data', {
    ...props.data,
    gossipCaCertificate,
  });
}

async function handleUpdateGrpcCert(str: string) {
  if (!str) {
    hash.value = '';
  } else if (!str.endsWith('\n')) {
    hash.value = await sha384(str + '\n');
  } else if (str.match(/(\n\r?)+$/)) {
    hash.value = await sha384(str.replace(/(\n\r?)+$/, '\n'));
  } else {
    hash.value = await sha384(str);
  }
  emit('update:data', {
    ...props.data,
    certificateHash: hexToUint8Array(hash.value),
  });
}

function handleImportClick(field: 'gossip' | 'grpc') {
  const fileRef = field === 'gossip' ? gossipFile : grpcFile;
  if (fileRef.value != null) {
    fileRef.value.click();
  }
}

async function handlePEMFileChange(e: Event, field: 'gossip' | 'grpc') {
  const textField = field === 'gossip' ? gossipCaCertificateText : grpcCertificate;
  const handler = field === 'gossip' ? handleUpdateGossipCert : handleUpdateGrpcCert;
  const fileRef = field === 'gossip' ? gossipFile : grpcFile;

  const reader = new FileReader();
  const target = e.target as HTMLInputElement;
  reader.readAsText(target.files![0]);
  reader.onload = async () => {
    if (typeof reader.result === 'string') {
      textField.value = reader.result;
      await handler(textField.value);
    }
  };

  if (fileRef.value != null) {
    fileRef.value.value = '';
  }
}

function handleInputValidation(e: Event) {
  const target = e.target as HTMLInputElement;
  try {
    validate100CharInput(target.value, 'Transaction Memo');
    nodeDescriptionError.value = false;
  } catch (error) {
    toast.error(getErrorMessage(error, 'Invalid Node Description'), errorToastOptions);
    nodeDescriptionError.value = true;
  }
}

/* Functions */
function emitGrpcProxyEndpoint() {
  const domainName = grpcProxyDomain.value.trim();
  const port = grpcProxyPort.value;

  if (!domainName && !port) {
    emit('update:data', {
      ...props.data,
      grpcWebProxyEndpoint: null,
    });
    return;
  }

  emit('update:data', {
    ...props.data,
    grpcWebProxyEndpoint: { ipAddressV4: '', domainName, port },
  });
}

function handleGrpcProxyDomainBlur() {
  const result = processEndpointInput(grpcProxyDomain.value, grpcProxyPort.value);
  grpcProxyDomain.value = result.ipOrDomain;
  grpcProxyPort.value = result.port;

  if (grpcProxyDomain.value && !isValidFqdn(grpcProxyDomain.value)) {
    toast.error('Invalid gRPC Web Proxy Endpoint: A valid FQDN is required', errorToastOptions);
  }

  emitGrpcProxyEndpoint();
}

function formatGrpcProxyPort(event: Event) {
  const target = event.target as HTMLInputElement;
  grpcProxyPort.value = target.value.replace(/[^0-9]/g, '');
  emitGrpcProxyEndpoint();
}

function formatPort(event: Event, key: 'gossip' | 'service') {
  const portMapping = {
    gossip: gossipPort,
    service: servicePort,
  };
  const target = event.target as HTMLInputElement;
  portMapping[key].value = target.value.replace(/[^0-9]/g, '');
}

function handleIpOrDomainBlur(key: 'gossip' | 'service') {
  const mapping = {
    gossip: { ipOrDomain: gossipIpOrDomain, port: gossipPort },
    service: { ipOrDomain: serviceIpOrDomain, port: servicePort },
  };

  const result = processEndpointInput(mapping[key].ipOrDomain.value, mapping[key].port.value);
  mapping[key].ipOrDomain.value = result.ipOrDomain;
  mapping[key].port.value = result.port;
}

/* Watchers */
watch(
  () => props.data.grpcWebProxyEndpoint,
  () => {
    if (props.data.grpcWebProxyEndpoint) {
      grpcProxyDomain.value = props.data.grpcWebProxyEndpoint.domainName || '';
      grpcProxyPort.value = props.data.grpcWebProxyEndpoint.port || '';
    }
  },
  { once: true },
);

watch(
  () => props.data.gossipCaCertificate,
  async () => {
    const result = await x509BytesFromPem(props.data.gossipCaCertificate);
    if (result) {
      const { hash, text } = result;
      publicKeyHash.value = hash;
      gossipCaCertificateText.value = text;
    }
  },
  { once: true },
);
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
  <div class="form-group mt-6 col-8 col-xxxl-6">
    <label class="form-label">Node Description</label>
    <AppInput
      @input="handleInputValidation"
      :model-value="data.description"
      @update:model-value="
        emit('update:data', {
          ...data,
          description: $event,
        })
      "
      :filled="true"
      maxlength="100"
      placeholder="Enter Node Description"
      :class="[nodeDescriptionError ? 'is-invalid' : '']"
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

  <div class="form-group mt-6">
    <AppSwitch
      :checked="!data.declineReward"
      @update:checked="
        emit('update:data', {
          ...data,
          declineReward: !$event,
        })
      "
      size="md"
      name="accept-reward"
      label="Accept Node Rewards"
      data-testid="switch-accept-reward"
    />
  </div>

  <hr class="separator my-5" />

  <label class="form-label"
    >Gossip Endpoints <span v-if="required" class="text-danger">*</span></label
  >
  <div class="text-micro mb-3">
    First endpoint must be for internal host, second endpoint must be for external host
  </div>
  <div class="row align-items-end">
    <div class="col-4 col-xxxl-3">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="gossipIpOrDomain"
        @blur="handleIpOrDomainBlur('gossip')"
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
      <div class="col-3 col-xxxl-3" />
      <div class="col-3 col-xxxl-3">
        <label class="form-label">IP/Domain</label>
      </div>

      <div class="col-3 col-xxxl-3">
        <label class="form-label">Port</label>
      </div>

      <div class="col-3 col-xxxl-3 text-center">
        <label class="form-label">Action</label>
      </div>
    </div>

    <div class="row">
      <div class="col-12 col-xxxl-9">
        <hr class="separator mb-3" />
      </div>
    </div>

    <label class="form-label mt-6"
      >Gossip Endpoints <span v-if="required" class="text-danger">*</span></label
    >
    <div v-for="(endpoint, index) of data.gossipEndpoints" :key="index" class="row py-3">
      <div class="col-3 col-xxxl-3 d-flex align-items-center text-small">
        <div v-if="index === 0">Internal</div>
        <div v-if="index === 1">External</div>
      </div>
      <div class="col-3 col-xxxl-3 d-flex align-items-center text-small">
        {{ endpoint.ipAddressV4 ? endpoint.ipAddressV4 : endpoint.domainName }}
      </div>
      <div class="col-3 col-xxxl-3 d-flex align-items-center text-small">{{ endpoint.port }}</div>
      <div class="col-3 col-xxxl-3 d-flex justify-content-center">
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

  <!-- Service Endpoint -->
  <label class="form-label mt-6"
    >Service Endpoints <span v-if="required" class="text-danger">*</span></label
  >
  <div class="row align-items-end">
    <div class="col-4 col-xxxl-3">
      <label class="form-label">IP/Domain</label>
      <input
        v-model="serviceIpOrDomain"
        @blur="handleIpOrDomainBlur('service')"
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
  <!-- gRPC Web Endpoint -->
  <div class="form-group mt-6">
    <label class="form-label">gRPC Web Proxy Endpoint</label>
    <div class="text-micro mb-3 text-muted">Fully Qualified Domain Name (FQDN) is required</div>
    <div class="row align-items-end">
      <div class="col-4 col-xxxl-3">
        <label class="form-label">Domain</label>
        <input
          v-model="grpcProxyDomain"
          @blur="handleGrpcProxyDomainBlur"
          class="form-control is-fill"
          placeholder="Enter FQDN"
        />
      </div>
      <div class="col-4 col-xxxl-3">
        <label class="form-label">Port</label>
        <input
          v-model="grpcProxyPort"
          @input="formatGrpcProxyPort($event)"
          class="form-control is-fill"
          placeholder="Enter Port"
        />
      </div>
    </div>
  </div>

  <hr class="separator my-5" />

  <div class="form-group" :class="['col-8 col-xxxl-6']">
    <div class="d-flex align-items-center mb-3">
      <label class="form-label mb-0"
        >Gossip CA Certificate <span v-if="required" class="text-danger">*</span></label
      >
      <input
        type="file"
        accept=".pem"
        ref="gossipFile"
        @change="handlePEMFileChange($event, 'gossip')"
      />
      <AppButton type="button" color="primary" class="ms-5" @click="handleImportClick('gossip')">
        Upload Pem
      </AppButton>
    </div>
    <AppTextArea
      :model-value="gossipCaCertificateText"
      @update:model-value="handleUpdateGossipCert"
      :filled="true"
      placeholder="Enter Gossip CA Certificate"
    />
  </div>

  <div class="form-group mt-6 col-8 col-xxxl-6">
    <label class="form-label">Public Key Hash</label>
    <p class="overflow-auto">{{ publicKeyHash }}</p>
  </div>

  <div class="form-group mt-6" :class="['col-8 col-xxxl-6']">
    <div class="d-flex align-items-center mb-3">
      <label class="form-label mb-0">GRPC Certificate</label>
      <input
        type="file"
        accept=".pem"
        ref="grpcFile"
        @change="handlePEMFileChange($event, 'grpc')"
      />
      <AppButton type="button" color="primary" class="ms-5" @click="handleImportClick('grpc')">
        Upload Pem
      </AppButton>
    </div>
    <AppTextArea
      :model-value="grpcCertificate"
      @update:model-value="handleUpdateGrpcCert"
      :filled="true"
      placeholder="Enter GRPC Certificate"
    />
  </div>

  <div class="form-group mt-6 col-8 col-xxxl-6">
    <label class="form-label">Certificate Hash</label>
    <p class="overflow-auto">{{ uint8ToHex(data.certificateHash) }}</p>
  </div>
</template>
