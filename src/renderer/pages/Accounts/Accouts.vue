<script setup lang="ts">
import AppButton from '../../components/ui/AppButton.vue';
</script>
<template>
  <div class="p-10">
    <div class="h-100 d-flex row">
      <div class="col-4 col-xl-3 border-end pe-4">
        <div class="dropdown">
          <AppButton
            color="primary"
            class="w-100 d-flex align-items-center justify-content-center"
            data-bs-toggle="dropdown"
            ><i class="bi bi-plus-lg text-subheader"></i> Add Account</AppButton
          >
          <ul class="dropdown-menu text-small">
            <li class="dropdown-item">
              <RouterLink to="create-transaction/createAccount" class="dropdown-item"
                ><i class="bi bi-plus-lg"></i>
                Create New
              </RouterLink>
            </li>
            <li class="dropdown-item">
              <RouterLink to="accounts/link-existing" class="dropdown-item"
                ><i class="bi bi-plus-lg"></i>
                Link Existing Account
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
      <div class="col-8 col-xl-9"></div>
    </div>
  </div>
</template>
