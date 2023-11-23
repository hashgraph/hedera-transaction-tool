<script setup lang="ts">
import { ref } from 'vue';

import Tabs, { TabItem } from '../components/ui/Tabs.vue';

const activeTabIndex = ref(0);

const tabItems: TabItem[] = [{ title: 'General' }, { title: 'Work Groups' }, { title: 'Keys' }];

const [general, workGroups, keys] = tabItems.map(t => t.title);
</script>
<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Settings</h1>
    <div class="mt-7">
      <Tabs :items="tabItems" v-model:active-index="activeTabIndex">
        <template #[general]>
          <!-- Local Storage -->
          <div class="p-4 border border-2 rounded-3">
            <p>Local Storage</p>
            <div class="mt-4 d-flex align-items-end">
              <div class="flex-1 me-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >app storage directory</label
                >
                <input type="text" class="form-control py-3" />
              </div>
              <div>
                <button type="button" class="btn btn-primary py-3 px-6">
                  <i class="bi bi-search me-3"></i>Browse
                </button>
              </div>
            </div>
          </div>
          <!-- Mirror Node Settings -->
          <div class="p-4 mt-7 border border-2 rounded-3">
            <p>Mirror Node Settings</p>
            <div class="mt-4">
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >Main NET MIRROR NODE LINK</label
                >
                <input type="text" class="form-control py-3" />
              </div>
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >TEST NET MIRROR NODE LINK</label
                >
                <input type="text" class="form-control py-3" />
              </div>
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >PREVIEW NET MIRROR NODE LINK</label
                >
                <input type="text" class="form-control py-3" />
              </div>
            </div>
          </div>
          <!-- Explorer Settings -->
          <div class="p-4 mt-7 border border-2 rounded-3">
            <p>Explorer Settings</p>
            <div class="mt-4">
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >Explorer Link</label
                >
                <input type="text" class="form-control py-3" />
              </div>
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >Explorer Name</label
                >
                <input type="text" class="form-control py-3" />
              </div>
            </div>
          </div>
        </template>
        <template #[workGroups]> Work groups tab </template>
        <template #[keys]> Keys tab </template>
      </Tabs>
    </div>
  </div>
</template>
