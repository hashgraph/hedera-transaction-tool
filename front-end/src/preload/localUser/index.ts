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
import transactionGroupsAPI from './transactionGroups';
import organizationsAPI from './organizations';
import organizationCredentialsAPI from './organizationCredentials';
import deepLinkAPI from './deepLink';
import contactsAPI from './contacts';
import contactPublicKeys from './linkedPublicKeys';
import encryptedKeys from './encryptedKeys';
import claim from './claim';
import safeStorage from './safeStorage';
import dataMigration from './dataMigration';
import sdk from './sdk';

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
  ...transactionGroupsAPI,
  ...organizationsAPI,
  ...organizationCredentialsAPI,
  ...deepLinkAPI,
  ...contactsAPI,
  ...contactPublicKeys,
  ...encryptedKeys,
  ...claim,
  ...safeStorage,
  ...dataMigration,
  ...sdk,
};
