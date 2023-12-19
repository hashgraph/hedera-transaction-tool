<script setup lang="ts">
import AppButton from '../../../components/ui/AppButton.vue';
import useNetworkStore from '../../../stores/storeNetwork';

const networkStore = useNetworkStore();
</script>
<template>
  <div>
    <!-- Network -->
    <div class="p-4 border border-2 rounded-3">
      <p>Network</p>
      <div class="mt-4 btn-group">
        <AppButton
          color="primary"
          disabled
          :class="{ active: networkStore.network === 'mainnet' }"
          @click="networkStore.setNetwork('mainnet')"
          >Mainnet</AppButton
        >
        <AppButton
          color="primary"
          :class="{ active: networkStore.network === 'testnet' }"
          @click="networkStore.setNetwork('testnet')"
          >Testnet</AppButton
        >
        <AppButton
          color="primary"
          disabled
          :class="{ active: networkStore.network === 'previewnet' }"
          @click="networkStore.setNetwork('previewnet')"
          >Previewnet</AppButton
        >
      </div>
    </div>
    <!-- Mirror Node Settings -->
    <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Mirror Node Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="form-label">Main NET MIRROR NODE LINK</label>
          <input
            type="text"
            class="form-control py-3"
            :value="networkStore.getMirrorNodeLinkByNetwork('mainnet')"
            readonly
          />
        </div>
        <div class="mb-4">
          <label class="form-label">TEST NET MIRROR NODE LINK</label>
          <input
            type="text"
            class="form-control py-3"
            :value="networkStore.getMirrorNodeLinkByNetwork('testnet')"
            readonly
          />
        </div>
        <div class="mb-4">
          <label class="form-label">PREVIEW NET MIRROR NODE LINK</label>
          <input
            type="text"
            class="form-control py-3"
            :value="networkStore.getMirrorNodeLinkByNetwork('previewnet')"
            readonly
          />
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
