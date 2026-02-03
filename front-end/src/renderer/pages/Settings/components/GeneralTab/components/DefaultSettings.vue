<script setup lang="ts">
import DefaultOrganization from './DefaultOrganization.vue';
import MaxTransactionFeeSetting from './MaxTransactionFeeSetting.vue';
import DateTimeSetting from '@renderer/pages/Settings/components/GeneralTab/components/DateTimeSetting.vue';
</script>
<template>
  <div class="p-4 border border-2 rounded-3 mt-5">
    <p>Default Settings</p>
    <MaxTransactionFeeSetting />
    <DefaultOrganization />
    <DateTimeSetting />
  </div>
</template>
