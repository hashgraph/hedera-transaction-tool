import './styles/styles.scss';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import router from '@renderer/router';
import { addGuards } from '@renderer/router/guards';

import ToastPlugin, { useToast } from 'vue-toast-notification';

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
const toast = useToast();

app.config.errorHandler = (err: unknown) => {
  console.log(err);
  toast.error(getErrorMessage(err, 'An error occured'));
};

/* Custom Components */
app.component('DatePicker', DatePicker);

/* App mount */
app.mount('#app');
