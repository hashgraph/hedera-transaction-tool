import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import StyleGuide from '../pages/Styleguide.vue';
import Transactions from '../pages/Transactions.vue';
import Accounts from '../pages/Accounts.vue';
import Tokens from '../pages/Tokens.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', component: StyleGuide },
  { path: '/transactions', component: Transactions },
  { path: '/accounts', component: Accounts },
  { path: '/tokens', component: Tokens },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
});

export default router;
