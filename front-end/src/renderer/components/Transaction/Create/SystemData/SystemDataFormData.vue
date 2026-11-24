<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue';
import { ContractId, FileId } from '@hiero-ledger/sdk';
import type { SystemData } from '@renderer/utils/sdk';
import ButtonGroup, { type ButtonGroupItem } from '@renderer/components/ui/ButtonGroup.vue';
import FileIdInput from '@renderer/components/FileIdInput.vue';
import ContractIdInput from '@renderer/components/ContractIdInput.vue';
import InputStatusView from '@renderer/components/InputStatusView.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';

/* Props */
const props = defineProps<{
  data: SystemData;
  required?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: SystemData): void;
}>();

/* State */
const fileId: Ref<FileId | null> = ref(null);
const fileIdStatus: Ref<InputStatus> = ref(InputStatus.empty);
const contractId: Ref<ContractId | null> = ref(null);
const contractIdStatus: Ref<InputStatus> = ref(InputStatus.empty);
const targetType: Ref<TargetType> = ref('file');

/* Computed */
type TargetType = 'file' | 'contract';
const buttonItems: ButtonGroupItem<TargetType>[] = [
  { label: 'File', value: 'file', id: 'tab-delete-target-file' },
  { label: 'Contract', value: 'contract', id: 'tab-delete-target-contract' },
];

const newFileOrContractId = computed(() => {
  return targetType.value === 'file' ? fileId.value : contractId.value;
});

const newFileOrContractStatus = computed(() => {
  return targetType.value === 'file' ? fileIdStatus.value : contractIdStatus.value;
});

/* Hooks */
watch(
  () => props.data.fileOrContractId,
  () => {
    if (props.data.fileOrContractId instanceof FileId) {
      targetType.value = 'file';
      fileId.value = props.data.fileOrContractId;
    } else if (props.data.fileOrContractId instanceof ContractId) {
      targetType.value = 'contract';
      contractId.value = props.data.fileOrContractId;
    } else {
      // Leaves targetType, fileId and contractId unchanged
    }
  },
  { immediate: true },
);
watch([newFileOrContractId, newFileOrContractStatus], () => {
  if (newFileOrContractStatus.value !== InputStatus.invalid) {
    emit('update:data', { ...props.data, fileOrContractId: newFileOrContractId.value });
  }
});

/* Misc */
const columnClass = 'col-5 col-xxxl-3';
</script>
<template>
  <div class="row">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Delete Target</label>
      <ButtonGroup
        :items="buttonItems"
        :activeValue="targetType"
        button-type="button"
        color="primary"
        @change="
          value => {
            targetType = value;
          }
        "
      />
    </div>
  </div>

  <div class="row mt-6">
    <template v-if="targetType == 'file'">
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">File ID <span class="text-danger">*</span></label>
        <FileIdInput v-model:fileId="fileId" @inputStatus="fileIdStatus = $event" />
        <InputStatusView :status="fileIdStatus" invalidMessage="Invalid file ID" />
      </div>
    </template>
    <template v-else>
      <div class="form-group" :class="[columnClass]">
        <label class="form-label">Contract ID <span class="text-danger">*</span></label>
        <ContractIdInput v-model:contractId="contractId" @inputStatus="contractIdStatus = $event" />
        <InputStatusView :status="contractIdStatus" invalidMessage="Invalid Contract ID" />
      </div>
    </template>
  </div>
</template>
