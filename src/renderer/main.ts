import { createApp } from 'vue';
import { createPinia } from 'pinia';

import './style.css';

import App from './App.vue';

const app = createApp(App);

app.use(createPinia());

app.mount('#app');

if (window.electronAPI.getNodeEnv() === 'development') {
  import('@vue/devtools').then(module => {
    module.connect(`http://localhost`);
  });
}
