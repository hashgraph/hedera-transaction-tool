import './styles/styles.scss';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import router from '@renderer/router';
import { addGuards } from '@renderer/router/guards';

import ToastPlugin from 'vue-toast-notification';

import DatePicker from '@vuepic/vue-datepicker';

import App from './App.vue';

import { AutoFocusFirstInputDirective } from './utils';
import { setupRendererLogging } from './utils/logger';

import {
  resetVersionStatusForOrg,
  setVersionDataForOrg,
  setVersionStatusForOrg,
} from '@renderer/stores/versionState';

setupRendererLogging();

const app = createApp(App);

/* App use */
app.use(router);

app.use(createPinia());

addGuards(router);

app.use(ToastPlugin, { position: 'bottom-right', duration: 4000 });

app.directive('focus-first-input', AutoFocusFirstInputDirective);

/* Custom Components */
app.component('DatePicker', DatePicker);

/* App mount */
app.mount('#app');

// Test-only hooks for Playwright (mutates module-scoped refs that are not on Pinia).
// Gated behind import.meta.env.DEV so production builds do not expose internal mutators.
if (import.meta.env.DEV) {
  const w = window as unknown as { __testHooks__?: Record<string, unknown> };
  w.__testHooks__ = {
    ...(w.__testHooks__ ?? {}),
    setVersionStatusForOrg,
    setVersionDataForOrg,
    resetVersionStatusForOrg,
  };
}
