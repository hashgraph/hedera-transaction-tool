import './styles/styles.scss';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import router from './router';
import { addGuards } from './router/guards';

import ToastPlugin, { useToast } from 'vue-toast-notification';

import App from './App.vue';

const app = createApp(App);

/* App use */
app.use(createPinia());

app.use(ToastPlugin);

addGuards(router);
app.use(router);

/* App config */
const toast = useToast();

app.config.errorHandler = (err: any) => {
  let message = 'An error occured';

  if (err.message) {
    message = err.message;
  }

  toast.error(message, { position: 'top-right' });
};

/* App mount */
app.mount('#app');

/* Vue Dev Tools */
// if (import.meta.env.DEV) {
//   import('@vue/devtools').then(module => {
//     module.connect('http://localhost');
//   });
// }
