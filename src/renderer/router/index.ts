import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import StyleGuideVue from '../components/StyleGuide.vue';

const routes: RouteRecordRaw[] = [{ path: '/', component: StyleGuideVue }];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
