<script lang="ts" setup>
import { ContractId, DelegateContractId } from '@hiero-ledger/sdk';

defineProps<{ component: unknown }>();
</script>
<template>
  <span v-if="component instanceof DelegateContractId">Delegate Contract {{ component.toString() }}</span>
  <span v-else-if="component instanceof ContractId">Contract {{ component.toString() }}</span>
  <span v-else class="text-danger text-bold" role="alert">
    Unsupported key type — transaction cannot be reviewed or signed
  </span>
</template>
