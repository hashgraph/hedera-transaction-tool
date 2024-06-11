<script setup lang="ts">
import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

/* Props */
defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
}>();

/* Stores */
const transactionGroup = useTransactionGroupStore();

/* Handlers */
async function handleSignTransaction(e: Event) {
  e.preventDefault();

  if (!transactionGroup.groupItems) throw new Error('Transaction not provided');

  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  if (user.selectedOrganization) {
    throw new Error(
      "User is in organization mode, shouldn't be able to sign before submitting to organization",
    );
  }

  try {
    isSigning.value = true;

    const signedTransactionBytes = await signTransaction(
      props.transactionBytes,
      localPublicKeysReq.value,
      user.personal.id,
      userPassword.value,
    );

    isSignModalShown.value = false;

    await executeTransaction(signedTransactionBytes);
  } catch (err: any) {
    toast.error(err.message || 'Transaction signing failed', { position: 'bottom-right' });
  } finally {
    isSigning.value = false;
  }
}
</script>
<template>
  <!-- Sign modal -->
  <AppModal
    :show="show"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'lock'" style="height: 160px" />
      </div>
      <form class="mt-3" @submit="handleSignGroup">
        <h3 class="text-center text-title text-bold">Enter your password</h3>
        <div class="form-group mt-5 mb-4">
          <label class="form-label">Password</label>
          <AppInput v-model="userPassword" size="small" type="password" :filled="true" />
        </div>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            :loading="isSigning"
            :disabled="userPassword.length === 0 || isSigning"
            type="submit"
            >Continue</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
