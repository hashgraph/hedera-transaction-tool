import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import { attachMeta } from './meta';

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
import AccountSetup from '../pages/AccountSetup';
import GeneralTab from '../pages/Settings/components/GeneralTab.vue';
import WorkGroupsTab from '../pages/Settings/components/WorkGroupsTab.vue';
import KeysTab from '../pages/Settings/components/KeysTab.vue';
import SetupOrganization from '../pages/SetupOrganization';
import RestoreKey from '../pages/RestoreKey';
import CreateTransaction from '../pages/CreateTransaction';
import AccountTab from '../pages/Settings/components/AccountTab.vue';
import ForgotPassword from '../pages/ForgotPassword';
import LinkExisting from '@renderer/pages/Accounts/LinkExisting/LinkExisting.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'welcome',
    component: Welocome,
  },
  { path: '/style-guide', name: 'styleGuide', component: StyleGuide },
  { path: '/transactions', name: 'transactions', component: Transactions },
  { path: '/accounts/link-existing', name: 'linkExistingAccount', component: LinkExisting },
  { path: '/accounts', name: 'accounts', component: Accounts },
  { path: '/tokens', name: 'tokens', component: Tokens },
  { path: '/smart-contracts', name: 'smartContracts', component: SmartContracts },
  { path: '/consensus-service', name: 'consensusService', component: ConsensusService },
  { path: '/file-service', name: 'fileService', component: FileService },
  { path: '/contact-list', name: 'contactList', component: ContactList },
  { path: '/help', name: 'help', component: Help },
  { path: '/account-setup', name: 'accountSetup', component: AccountSetup },
  { path: '/setup-organization', name: 'setupOrganization', component: SetupOrganization },
  { path: '/restore-key', name: 'restoreKey', component: RestoreKey },
  { path: '/create-transaction/:type', name: 'createTransaction', component: CreateTransaction },
  { path: '/forgot-password', name: 'forgotPassword', component: ForgotPassword },
  {
    path: '/settings',
    name: 'settings',
    component: Settings,
    children: [
      {
        path: 'general',
        name: 'settingsGeneral',
        component: GeneralTab,
      },
      {
        path: 'work-groups',
        name: 'settingsWorkGroups',
        component: WorkGroupsTab,
      },
      {
        path: 'keys',
        name: 'settingsKeys',
        component: KeysTab,
      },
      {
        path: 'account',
        name: 'settingsAccount',
        component: AccountTab,
      },
    ],
  },
  { path: '/:catchAll(.*)', redirect: '/' },
];

attachMeta(routes);

const router = createRouter({
  history: createWebHistory(),
  routes,
  linkActiveClass: 'active',
});

export default router;
