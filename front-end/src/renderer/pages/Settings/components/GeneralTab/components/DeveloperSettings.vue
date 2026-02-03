<script setup lang="ts">
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import useDeveloperMode from '@renderer/stores/useDeveloperMode.ts';

/* Stores */
const developerMode = useDeveloperMode();

/* Handlers */
const handleSwitch = async (newValue: boolean) => {
  await developerMode.setEnabled(newValue);
};
</script>

<template>
  <div class="fill-remaining border border-2 rounded-3 p-4 mt-5">
    <p>Developer</p>
    <div class="mt-4">
      <AppSwitch
        :checked="developerMode.enabled"
        @update:checked="handleSwitch"
        name="threshold-reached"
        label="Developer Mode"
      />
      <p class="text-small text-secondary mt-2">
        Enables access to testnet, previewnet and custom networks
      </p>
    </div>
  </div>
</template>
