import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import StyleGuide from '../pages/Styleguide.vue';
import Transactions from '../pages/Transactions.vue';
import Accounts from '../pages/Accounts.vue';
import Tokens from '../pages/Tokens.vue';
import Help from '../pages/Help.vue';
import Settings from '../pages/Settings.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', component: StyleGuide },
  { path: '/transactions', component: Transactions },
  { path: '/accounts', component: Accounts },
  { path: '/tokens', component: Tokens },
  { path: '/help', component: Help },
  { path: '/settings', component: Settings },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
});

export default router;
