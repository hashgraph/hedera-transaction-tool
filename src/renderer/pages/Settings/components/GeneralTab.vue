<script setup lang="ts">
import useMirrorNodeLinksStore from '../../../stores/storeMirrorNodeLinks';

import AppButton from '../../../components/ui/AppButton.vue';

const mirrorNodeLinksStore = useMirrorNodeLinksStore();

const handleMirrorNodeLinkChange = (
  node: 'mainnetLink' | 'testnetLink' | 'previewnetLink',
  e: Event,
) => {
  const input = e.currentTarget as HTMLInputElement;
  mirrorNodeLinksStore.setMirroNodeLink(node, input.value);
};
</script>
<template>
  <div>
    <!-- Local Storage -->
    <!-- <div class="p-4 border border-2 rounded-3">
      <p>Local Storage</p>
      <div class="mt-4 d-flex align-items-end">
        <div class="flex-1 me-4">
          <label class="form-label">App storage directory</label>
          <input type="text" class="form-control py-3" />
        </div>
        <div>
          <AppButton color="primary" class="py-3 px-6">
            <i class="bi bi-search me-3"></i>Browse
          </AppButton>
        </div>
      </div>
    </div> -->
    <!-- Mirror Node Settings -->
    <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Mirror Node Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="form-label">Main NET MIRROR NODE LINK</label>
          <input
            type="text"
            class="form-control py-3"
            :value="mirrorNodeLinksStore.mirrorNodeLinks.mainnetLink"
            @change="e => handleMirrorNodeLinkChange('mainnetLink', e)"
          />
        </div>
        <div class="mb-4">
          <label class="form-label">TEST NET MIRROR NODE LINK</label>
          <input type="text" class="form-control py-3" />
        </div>
        <div class="mb-4">
          <label class="form-label">PREVIEW NET MIRROR NODE LINK</label>
          <input type="text" class="form-control py-3" />
        </div>
      </div>
    </div>
    <!-- Explorer Settings -->
    <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Explorer Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="form-label">Explorer Link</label>
          <input type="text" class="form-control py-3" />
        </div>
        <div class="mb-4">
          <label class="form-label">Explorer Name</label>
          <input type="text" class="form-control py-3" />
        </div>
      </div>
    </div>
  </div>
</template>
