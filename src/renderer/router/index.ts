import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import StyleGuide from '../pages/Styleguide.vue';
import Transactions from '../pages/Transactions.vue';
import Accounts from '../pages/Accounts.vue';
import Tokens from '../pages/Tokens.vue';
import Help from '../pages/Help.vue';
import Settings from '../pages/Settings.vue';
import SmartContracts from '../pages/SmartContracts.vue';
import ConsensusService from '../pages/ConsensusService.vue';
import FileService from '../pages/FileService.vue';
import ContactList from '../pages/ContactList.vue';
import Login from '../pages/Login.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', component: StyleGuide },
  { path: '/transactions', component: Transactions },
  { path: '/accounts', component: Accounts },
  { path: '/tokens', component: Tokens },
  { path: '/smart-contracts', component: SmartContracts },
  { path: '/consensus-service', component: ConsensusService },
  { path: '/file-service', component: FileService },
  { path: '/contact-list', component: ContactList },
  { path: '/help', component: Help },
  { path: '/settings', component: Settings },
  { path: '/login', component: Login },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
});

export default router;
