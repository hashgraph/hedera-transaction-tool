import './styles/styles.scss';

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import router from './router';
import { addGuards } from './router/guards';

import ToastPlugin from 'vue-toast-notification';

import App from './App.vue';

const app = createApp(App);

/* App use */
app.use(createPinia());

app.use(ToastPlugin);

addGuards(router);
app.use(router);

/* App mount */
app.mount('#app');

// /* Vue Dev Tools */
// if (window.electronAPI.getNodeEnv() === 'development') {
//   import('@vue/devtools').then(module => {
//     module.connect(`http://localhost`);
//   });
// }
