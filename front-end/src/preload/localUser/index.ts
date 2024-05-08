import updateAPI from './update';
import themeAPI from './theme';
import keyPairsAPI from './keyPairs';
import utilsAPI from './utils';
import accountsAPI from './accounts';
import filesAPI from './files';
import complexKeysAPI from './complexKeys';
import localUserAPI from './localUser';
import transactionsAPI from './transactions';
import transactionDraftsAPI from './transactionDrafts';
import organizationsAPI from './organizations';
import organizationCredentialsAPI from './organizationCredentials';
import deepLinkAPI from './deepLink';
import contactsAPI from './contacts';
import contactPublicKeys from './linkedPublicKeys';

export default {
  ...updateAPI,
  ...themeAPI,
  ...keyPairsAPI,
  ...utilsAPI,
  ...accountsAPI,
  ...filesAPI,
  ...complexKeysAPI,
  ...localUserAPI,
  ...transactionsAPI,
  ...transactionDraftsAPI,
  ...organizationsAPI,
  ...organizationCredentialsAPI,
  ...deepLinkAPI,
  ...contactsAPI,
  ...contactPublicKeys,
};
