import './styles/styles.scss';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import router from '@renderer/router';
import { addGuards } from '@renderer/router/guards';

import ToastPlugin from 'vue-toast-notification';
import { ToastManager } from './utils/ToastManager';

import DatePicker from '@vuepic/vue-datepicker';

import App from './App.vue';

import { AutoFocusFirstInputDirective, getErrorMessage } from './utils';

const app = createApp(App);

/* App use */
app.use(router);

app.use(createPinia());

addGuards(router);

app.use(ToastPlugin, { position: 'bottom-right', duration: 4000 });

app.directive('focus-first-input', AutoFocusFirstInputDirective);

/* App config */
const toastManager = ToastManager.inject()

app.config.errorHandler = (err: unknown) => {
  console.log(err);
  toastManager.error(getErrorMessage(err, 'An error occurred'));
};

/* Custom Components */
app.component('DatePicker', DatePicker);

/* App mount */
app.mount('#app');
