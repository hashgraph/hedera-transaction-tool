<script lang="ts" setup>
import AppButton from '@renderer/components/ui/AppButton.vue';
import { onBeforeMount, ref, watch } from 'vue';
import { isUserLoggedIn, safeAwait } from '@renderer/utils';
import { getStoredClaim, setStoredClaim } from '@renderer/services/claimService.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import { GO_NEXT_AFTER_SIGN } from '@shared/constants';

/* Props */
const props = defineProps<{
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
}>();

/* Stores */
const user = useUserStore();

/* State */
const goToNext = ref(false);

/* Watchers */
watch(goToNext, async () => {
  if (isUserLoggedIn(user.personal)) {
    await setStoredClaim(user.personal.id, GO_NEXT_AFTER_SIGN, goToNext.value.toString());
  }
});

/* Lifecycle */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    const claimValue = await safeAwait(getStoredClaim(user.personal.id, GO_NEXT_AFTER_SIGN));
    if (claimValue.data) {
      goToNext.value = claimValue.data === 'true';
    }
  }
});
</script>
<template>
  <div class="btn-group">
    <AppButton
      class="main-button"
      :disabled="props.disabled || props.loading"
      :loading="props.loading"
      :loading-text="props.loadingText"
      color="primary"
      type="submit"
    >
      {{ goToNext ? 'Sign & Next' : 'Sign' }}
    </AppButton>
    <AppButton
      :disabled="props.disabled || props.loading"
      class="dropdown-toggle dropdown-toggle-split"
      color="primary"
      data-bs-toggle="dropdown"
      data-bs-offset="0,6"
    >
      <span class="visually-hidden">Toggle Dropdown</span>
    </AppButton>
    <ul class="dropdown-menu">
      <li @click="goToNext = false">
        <div class="dropdown-item cursor-pointer d-flex gap-2 align-items-start">
          <i :class="['bi', 'bi-check-lg', goToNext ? 'invisible' : 'visible']" />
          <div class="option-content">
            <div class="option-label">Sign</div>
            <div class="option-description">Sign this transaction</div>
          </div>
        </div>
      </li>
      <li><hr class="dropdown-divider" /></li>
      <li @click="goToNext = true">
        <div class="dropdown-item cursor-pointer d-flex gap-2 align-items-start">
          <i :class="['bi', 'bi-check-lg', goToNext ? 'visible' : 'invisible']" />
          <div class="option-content">
            <div class="option-label">Sign & Next</div>
            <div class="option-description">
              Sign this transaction and navigate to the next element in the list
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dropdown-divider {
  margin: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.dropdown-item {
  padding: 0.75rem 1rem 0.75rem 0.5rem;
  white-space: normal;
}

.dropdown-menu {
  min-width: 280px;
  padding: 0;
  overflow: hidden;
  border-radius: 6px;
}

.dropdown-toggle {
  min-width: 42px;
}

.dropdown-toggle-split {
  border-left: 1px solid rgba(255, 255, 255, 0.3);
}

.main-button {
  border-right: 1px solid rgba(255, 255, 255, 0.3);
  min-width: 125px;
}

.option-label {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.option-description {
  font-size: 0.75rem;
  opacity: 0.8;
  line-height: 1.4;
}
</style>
