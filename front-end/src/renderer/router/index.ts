import { RouteRecordRaw, createRouter, createWebHistory } from 'vue-router';

import { attachMeta } from './meta';

import Transactions from '@renderer/pages/Transactions';
import UserLogin from '@renderer/pages/UserLogin';

const StyleGuide = () => import('@renderer/pages/Styleguide');
const Accounts = () => import('@renderer/pages/Accounts');
const Tokens = () => import('@renderer/pages/Tokens');
const Help = () => import('@renderer/pages/Help');
const Settings = () => import('@renderer/pages/Settings');
const SmartContracts = () => import('@renderer/pages/SmartContracts');
const ConsensusService = () => import('@renderer/pages/ConsensusService');
const Files = () => import('@renderer/pages/Files');
const ContactList = () => import('@renderer/pages/ContactList');
const AccountSetup = () => import('@renderer/pages/AccountSetup');
const GeneralTab = () => import('@renderer/pages/Settings/components/GeneralTab.vue');
const WorkGroupsTab = () => import('@renderer/pages/Settings/components/WorkGroupsTab.vue');
const KeysTab = () => import('@renderer/pages/Settings/components/KeysTab.vue');
const RestoreKey = () => import('@renderer/pages/RestoreKey');
const CreateTransaction = () => import('@renderer/pages/CreateTransaction');
const ProfileTab = () => import('@renderer/pages/Settings/components/ProfileTab.vue');
const ForgotPassword = () => import('@renderer/pages/ForgotPassword');
const LinkExistingAccount = () => import('@renderer/pages/Accounts/LinkExistingAccount');
const LinkExistingFile = () => import('@renderer/pages/Files/LinkExistingFile');
const OrganizationLogin = () => import('@renderer/pages/OrganizationLogin');
const OrganizationConnectionsTab = () =>
  import('@renderer/pages/Settings/components/OrganizationConnectionsTab.vue');

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/transactions' },
  { path: '/login', name: 'login', component: UserLogin },
  { path: '/organization-login', name: 'organizationLogin', component: OrganizationLogin },
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
        path: 'profile',
        name: 'settingsAccount',
        component: ProfileTab,
      },
      {
        path: 'organization-connections',
        name: 'settingsOrganizationConnections',
        component: OrganizationConnectionsTab,
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
