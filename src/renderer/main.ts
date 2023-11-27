import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ToastPlugin from 'vue-toast-notification';
import './styles/styles.scss';

import App from './App.vue';
import router from './router';

const app = createApp(App);

app.use(createPinia());
app.use(ToastPlugin);
app.use(router);

app.mount('#app');

// if (window.electronAPI.getNodeEnv() === 'development') {
//   import('@vue/devtools').then(module => {
//     module.connect(`http://localhost`);
//   });
// }
