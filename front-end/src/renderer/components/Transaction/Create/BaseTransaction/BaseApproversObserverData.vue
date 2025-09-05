<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils';

import UsersGroup from '@renderer/components/Organization/UsersGroup.vue';
import ApproversList from '@renderer/components/Approvers/ApproversList.vue';

/* Props */
defineProps<{
  observers: number[];
  approvers: TransactionApproverDto[];
}>();

/* Emits */
defineEmits<{
  (event: 'update:observers', value: number[]): void;
  (event: 'update:approvers', value: TransactionApproverDto[]): void;
}>();

/* Stores */
const user = useUserStore();
</script>
<template>
  <template v-if="isLoggedInOrganization(user.selectedOrganization)">
    <div class="row mt-6">
      <div class="form-group col-12 col-xxxl-8">
        <label class="form-label">Observers</label>
        <UsersGroup
          :userIds="observers"
          @update:userIds="$emit('update:observers', $event)"
          :addable="true"
          :editable="true"
        />
      </div>
    </div>
    <div class="row mt-6">
      <div class="form-group col-12 col-xxxl-8">
        <label class="form-label">Approvers</label>
        <ApproversList
          :approvers="approvers"
          @update:approvers="$emit('update:approvers', $event)"
          :editable="true"
        />
      </div>
    </div>
  </template>
</template>
