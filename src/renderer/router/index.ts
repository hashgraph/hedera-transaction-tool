import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import StyleGuide from '../pages/PageStyleguide.vue';
import Transactions from '../pages/PageTransactions.vue';
import Accounts from '../pages/PageAccounts.vue';
import Tokens from '../pages/PageTokens.vue';

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
