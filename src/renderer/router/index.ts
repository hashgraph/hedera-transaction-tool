import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import { attachMeta } from './meta';

import Welocome from '@renderer/pages/Welcome';
import StyleGuide from '@renderer/pages/Styleguide';
import Transactions from '@renderer/pages/Transactions';
import Accounts from '@renderer/pages/Accounts';
import Tokens from '@renderer/pages/Tokens';
import Help from '@renderer/pages/Help';
import Settings from '@renderer/pages/Settings';
import SmartContracts from '@renderer/pages/SmartContracts';
import ConsensusService from '@renderer/pages/ConsensusService';
import Files from '@renderer/pages/Files';
import ContactList from '@renderer/pages/ContactList';
import AccountSetup from '@renderer/pages/AccountSetup';
import GeneralTab from '@renderer/pages/Settings/components/GeneralTab.vue';
import WorkGroupsTab from '@renderer/pages/Settings/components/WorkGroupsTab.vue';
import KeysTab from '@renderer/pages/Settings/components/KeysTab.vue';
import SetupOrganization from '@renderer/pages/SetupOrganization';
import RestoreKey from '@renderer/pages/RestoreKey';
import CreateTransaction from '@renderer/pages/CreateTransaction';
import AccountTab from '@renderer/pages/Settings/components/AccountTab.vue';
import ForgotPassword from '@renderer/pages/ForgotPassword';
import LinkExistingAccount from '@renderer/pages/Accounts/LinkExistingAccount';
import LinkExistingFile from '@renderer/pages/Files/LinkExistingFile';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'welcome',
    component: Welocome,
  },
  { path: '/style-guide', name: 'styleGuide', component: StyleGuide },
  { path: '/transactions', name: 'transactions', component: Transactions },
  { path: '/accounts/link-existing', name: 'linkExistingAccount', component: LinkExistingAccount },
  { path: '/accounts', name: 'accounts', component: Accounts },
  { path: '/tokens', name: 'tokens', component: Tokens },
  { path: '/smart-contracts', name: 'smartContracts', component: SmartContracts },
  { path: '/consensus-service', name: 'consensusService', component: ConsensusService },
  { path: '/files', name: 'files', component: Files },
  { path: '/files/link-existing', name: 'linkExistingFile', component: LinkExistingFile },
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
