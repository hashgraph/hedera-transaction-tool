<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { getMirrorNodeConfig, setMirrorNodeLink } from '../../../services/configurationService';

const initialMirrorNodeLinks = {
  mainnetLink: '',
  testnetLink: '',
  previewnetLink: '',
};

const mirrorNodeLinks = ref(initialMirrorNodeLinks);

onMounted(async () => {
  const links = await getMirrorNodeConfig();

  mirrorNodeLinks.value = links || initialMirrorNodeLinks;
});

watch(
  () => mirrorNodeLinks.value.mainnetLink,
  link => setMirrorNodeLink('mainnetLink', link),
);

// Temporary
const handleClearConfig = () => {
  mirrorNodeLinks.value = initialMirrorNodeLinks;
};
</script>
<template>
  <div>
    <button class="btn btn-secondary mb-4" @click="handleClearConfig">Clear Config</button>

    <!-- Local Storage -->
    <div class="p-4 border border-2 rounded-3">
      <p>Local Storage</p>
      <div class="mt-4 d-flex align-items-end">
        <div class="flex-1 me-4">
          <label class="text-secondary-emphasis text-footnote text-uppercase"
            >app storage directory</label
          >
          <input type="text" class="form-control py-3" />
        </div>
        <div>
          <button type="button" class="btn btn-primary py-3 px-6">
            <i class="bi bi-search me-3"></i>Browse
          </button>
        </div>
      </div>
    </div>
    <!-- Mirror Node Settings -->
    <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Mirror Node Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="text-secondary-emphasis text-footnote text-uppercase"
            >Main NET MIRROR NODE LINK</label
          >
          <input type="text" class="form-control py-3" v-model="mirrorNodeLinks.mainnetLink" />
        </div>
        <div class="mb-4">
          <label class="text-secondary-emphasis text-footnote text-uppercase"
            >TEST NET MIRROR NODE LINK</label
          >
          <input type="text" class="form-control py-3" v-model="mirrorNodeLinks.testnetLink" />
        </div>
        <div class="mb-4">
          <label class="text-secondary-emphasis text-footnote text-uppercase"
            >PREVIEW NET MIRROR NODE LINK</label
          >
          <input type="text" class="form-control py-3" v-model="mirrorNodeLinks.previewnetLink" />
        </div>
      </div>
    </div>
    <!-- Explorer Settings -->
    <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Explorer Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="text-secondary-emphasis text-footnote text-uppercase">Explorer Link</label>
          <input type="text" class="form-control py-3" />
        </div>
        <div class="mb-4">
          <label class="text-secondary-emphasis text-footnote text-uppercase">Explorer Name</label>
          <input type="text" class="form-control py-3" />
        </div>
      </div>
    </div>
  </div>
</template>
