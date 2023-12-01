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
import GeneralTab from '../pages/Settings/components/GeneralTab.vue';
import WorkGroupsTab from '../pages/Settings/components/WorkGroupsTab.vue';
import KeysTab from '../pages/Settings/components/KeysTab.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'welcome',
    component: Welocome,
  },
  { path: '/style-guide', name: 'styleGuide', component: StyleGuide },
  { path: '/transactions', name: 'transactions', component: Transactions },
  { path: '/accounts', name: 'accounts', component: Accounts },
  { path: '/tokens', name: 'tokens', component: Tokens },
  { path: '/smart-contracts', name: 'smartContracts', component: SmartContracts },
  { path: '/consensus-service', name: 'consensusService', component: ConsensusService },
  { path: '/file-service', name: 'fileService', component: FileService },
  { path: '/contact-list', name: 'contactList', component: ContactList },
  { path: '/help', name: 'help', component: Help },
  { path: '/recovery-phrase', name: 'recoveryPhrase', component: RecoveryPhrase },
  { path: '/login', name: 'login', component: Login },
  {
    path: '/settings',
    name: 'settings',
    component: Settings,
    children: [
      {
        path: 'general',
        component: GeneralTab,
      },
      {
        path: 'work-groups',
        component: WorkGroupsTab,
      },
      {
        path: 'keys',
        component: KeysTab,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
});

export default router;
