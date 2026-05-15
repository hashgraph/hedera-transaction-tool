<script setup lang="ts">
import type {
  ComponentRegisteredServiceEndpoint,
  RegisteredEndpointType,
} from '@renderer/utils/sdk';

import { computed } from 'vue';

import { BlockNodeApi } from '@hiero-ledger/sdk';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';

/* Props */
const props = defineProps<{
  endpoint: ComponentRegisteredServiceEndpoint;
  index: number;
  typeOptions: { value: RegisteredEndpointType; label: string }[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:endpoint', endpoint: ComponentRegisteredServiceEndpoint): void;
  (event: 'delete'): void;
}>();

/**
 * Block-node API options shown to the user.
 *
 * Derived at module-evaluation time from the SDK's `BlockNodeApi` static
 * instances rather than a hand-maintained list — so when the SDK adds a new
 * enum value in a future release, this UI picks it up automatically.
 *
 * `Number(api)` invokes `BlockNodeApi.valueOf()` (which returns the numeric
 * proto code) without reaching into the underscore-prefixed `_code` field.
 *
 * NOTE: keep this in sync with `@hiero-ledger/sdk` `BlockNodeApi`. As of
 * v2.84.0 the enumerable statics are: OTHER, STATUS, PUBLISH, SUBSCRIBE_STREAM,
 * STATE_PROOF. If a future SDK build switches those to non-enumerable, this
 * extraction returns an empty array — `assertHasBlockNodeApiOptions` below
 * makes that failure loud rather than silently disabling all checkboxes.
 */
const BLOCK_NODE_API_OPTIONS: { code: number; label: string }[] = Object.values(
  BlockNodeApi as unknown as Record<string, unknown>,
)
  .filter((v): v is InstanceType<typeof BlockNodeApi> => v instanceof BlockNodeApi)
  .map(api => ({ code: Number(api), label: api.toString() }))
  .sort((a, b) => a.code - b.code);

if (BLOCK_NODE_API_OPTIONS.length === 0) {
  // Loud failure — silent zero-option list would hide the block-node API
  // checkboxes entirely without any indication something is wrong.
  // eslint-disable-next-line no-console -- diagnostic only fires on SDK shape regression
  console.error(
    '[RegisteredNodeCreate/EndpointRow] No BlockNodeApi enum values discovered ' +
      'on the SDK class. The SDK build may have changed static enumerability — ' +
      'block-node API checkboxes will not render. Update the option-derivation ' +
      'strategy in EndpointRow.vue.',
  );
}

const blockNodeApiOptions = computed(() => BLOCK_NODE_API_OPTIONS);

/* Helpers */
function patch(partial: Partial<ComponentRegisteredServiceEndpoint>) {
  emit('update:endpoint', { ...props.endpoint, ...partial });
}

function handleTypeChange(value: RegisteredEndpointType) {
  // Reset subtype-specific fields when switching type so we don't carry stale data.
  patch({
    type: value,
    endpointApis: value === 'blockNode' ? [] : undefined,
    endpointDescription: value === 'generalService' ? '' : undefined,
  });
}

function handlePortInput(e: Event) {
  const target = e.target as HTMLInputElement;
  patch({ port: target.value.replace(/[^0-9]/g, '') });
}

function toggleApi(code: number, checked: boolean) {
  const current = new Set(props.endpoint.endpointApis ?? []);
  if (checked) current.add(code);
  else current.delete(code);
  patch({ endpointApis: Array.from(current).sort((a, b) => a - b) });
}

function isApiSelected(code: number) {
  return (props.endpoint.endpointApis ?? []).includes(code);
}
</script>

<template>
  <div class="border rounded p-4 mt-4" :data-testid="`registered-endpoint-row-${index}`">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h5 class="text-small fw-bold mb-0">Endpoint #{{ index + 1 }}</h5>
      <AppButton
        type="button"
        color="danger"
        :data-testid="`button-delete-registered-endpoint-${index}`"
        @click="emit('delete')"
      >
        Delete
      </AppButton>
    </div>

    <!-- Type selector -->
    <div class="form-group">
      <label class="form-label">Type <span class="text-danger">*</span></label>
      <select
        class="form-control is-fill"
        :value="endpoint.type"
        :data-testid="`select-registered-endpoint-type-${index}`"
        @change="
          handleTypeChange(
            ($event.target as HTMLSelectElement).value as RegisteredEndpointType,
          )
        "
      >
        <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- IP / Domain / Port -->
    <div class="row align-items-end mt-3">
      <div class="col-4 col-xxxl-3">
        <label class="form-label">IP Address (IPv4)</label>
        <AppInput
          :model-value="endpoint.ipAddressV4 ?? ''"
          @update:model-value="
            patch({ ipAddressV4: $event, domainName: $event ? '' : endpoint.domainName })
          "
          :filled="true"
          placeholder="e.g. 10.0.0.1"
          :data-testid="`input-registered-endpoint-ip-${index}`"
        />
      </div>
      <div class="col-4 col-xxxl-3">
        <label class="form-label">Domain Name</label>
        <AppInput
          :model-value="endpoint.domainName ?? ''"
          @update:model-value="
            patch({ domainName: $event, ipAddressV4: $event ? '' : endpoint.ipAddressV4 })
          "
          :filled="true"
          placeholder="e.g. node.example.com"
          :data-testid="`input-registered-endpoint-domain-${index}`"
        />
      </div>
      <div class="col-4 col-xxxl-3">
        <label class="form-label">Port <span class="text-danger">*</span></label>
        <input
          :value="endpoint.port ?? ''"
          @input="handlePortInput"
          class="form-control is-fill"
          placeholder="0-65535"
          :data-testid="`input-registered-endpoint-port-${index}`"
        />
      </div>
    </div>

    <!-- TLS switch -->
    <div class="form-group mt-4">
      <AppSwitch
        :checked="endpoint.requiresTls"
        @update:checked="patch({ requiresTls: $event })"
        size="md"
        :name="`registered-endpoint-tls-${index}`"
        label="Requires TLS"
        :data-testid="`switch-registered-endpoint-tls-${index}`"
      />
    </div>

    <!-- Block Node — endpoint APIs -->
    <div v-if="endpoint.type === 'blockNode'" class="form-group mt-4">
      <label class="form-label">Block Node APIs</label>
      <div class="text-micro text-muted mb-2">
        Select which block-node APIs this endpoint serves.
      </div>
      <div class="d-flex flex-wrap gap-3">
        <label
          v-for="opt in blockNodeApiOptions"
          :key="opt.code"
          class="d-inline-flex align-items-center gap-2 text-small"
        >
          <input
            type="checkbox"
            :checked="isApiSelected(opt.code)"
            :data-testid="`checkbox-registered-endpoint-${index}-api-${opt.code}`"
            @change="toggleApi(opt.code, ($event.target as HTMLInputElement).checked)"
          />
          {{ opt.label }}
        </label>
      </div>
    </div>

    <!-- General Service — description -->
    <div v-if="endpoint.type === 'generalService'" class="form-group mt-4">
      <label class="form-label">Endpoint Description</label>
      <AppTextArea
        :model-value="endpoint.endpointDescription ?? ''"
        @update:model-value="patch({ endpointDescription: $event })"
        :filled="true"
        placeholder="Describe what this general-service endpoint provides"
        :data-testid="`textarea-registered-endpoint-general-desc-${index}`"
      />
    </div>
  </div>
</template>
