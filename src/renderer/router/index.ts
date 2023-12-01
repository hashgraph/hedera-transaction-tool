import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import Welocome from '../pages/Welcome';
import StyleGuide from '../pages/Styleguide';
import Transactions from '../pages/Transactions';
import Accounts from '../pages/Accounts';
import Tokens from '../pages/Tokens';
import Help from '../pages/Help';
import Settings from '../pages/Settings';
import SmartContracts from '../pages/SmartContracts';
import ConsensusService from '../pages/ConsensusService';
import FileService from '../pages/FileService';
import ContactList from '../pages/ContactList';
import RecoveryPhrase from '../pages/RecoveryPhrase';
import Login from '../pages/Login';

const routes: RouteRecordRaw[] = [
  { path: '/', component: Welocome },
  { path: '/style-guide', component: StyleGuide },
  { path: '/transactions', component: Transactions },
  { path: '/accounts', component: Accounts },
  { path: '/tokens', component: Tokens },
  { path: '/smart-contracts', component: SmartContracts },
  { path: '/consensus-service', component: ConsensusService },
  { path: '/file-service', component: FileService },
  { path: '/contact-list', component: ContactList },
  { path: '/help', component: Help },
  { path: '/settings/:tab', component: Settings, props: true },
  { path: '/recovery-phrase', component: RecoveryPhrase },
  { path: '/login', component: Login },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
});

export default router;
