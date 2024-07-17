<script setup lang="ts">
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
</script>

<template>
  <div>
    <div class="fill-remaining border border-2 rounded-3 p-4">
      <p>Email notifications</p>
      <div class="mt-4">
        <AppSwitch
          checked
          name="accept-staking-rewards"
          label="Transaction Threshold Reached"
          labelClass="text-secondary"
        />
        <p class="text-small text-secondary mt-2">
          You will be notified when a transaction you are a Signer in has collected enough signature
          to satisfy the threshold.
        </p>
      </div>
      <div class="mt-6">
        <AppSwitch
          checked
          name="accept-staking-rewards"
          label="Required Signature"
          labelClass="text-small text-secondary"
        />
        <p class="text-small text-secondary mt-2">
          You will be notified whenever a transaction, which requires your signature has been
          created.
        </p>
      </div>
    </div>
  </div>
</template>
