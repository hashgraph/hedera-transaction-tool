<script lang="ts" setup>
import { ContractId, DelegateContractId } from '@hiero-ledger/sdk';

defineProps<{ item: unknown }>();
</script>
<template>
  <span v-if="item instanceof DelegateContractId">Delegate Contract {{ item.toString() }}</span>
  <span v-else-if="item instanceof ContractId">Contract {{ item.toString() }}</span>
  <span v-else class="text-danger text-bold" role="alert">
    Unsupported key type — transaction cannot be reviewed or signed
  </span>
</template>
