import logger from 'electron-log';
import { is } from '@electron-toolkit/utils';

export default function () {
  /* Main logger */
  const mainLogger = logger.default;
  mainLogger.transports.file.fileName = `main${is.dev ? '-dev' : ''}.log`;
  mainLogger.transports.file.level = 'debug';

  /* Info logger */
  const infoLogger = logger.create({ logId: 'info' });
  infoLogger.transports.file.fileName = `info${is.dev ? '-dev' : ''}.log`;
  infoLogger.transports.file.level = 'info';

  /* Error logger */
  const errorLogger = logger.create({ logId: 'error' });
  errorLogger.transports.file.fileName = `error${is.dev ? '-dev' : ''}.log`;
  errorLogger.transports.file.level = 'error';

  if (is.dev) {
    mainLogger.transports.console.format = '{text}';
    infoLogger.transports.console.level = false;
    errorLogger.transports.console.level = false;
  }

  console.log = (...data: any[]) => {
    mainLogger.log(...data);
    infoLogger.log(...data);
  };
  console.info = (...data: any[]) => {
    infoLogger.log(...data);
  };
  console.error = (...data: any[]) => {
    mainLogger.log(...data);
    errorLogger.log(...data);
  };
}

/* Update Logger */
export function getUpdateLogger() {
  const updateLogger = logger.create({ logId: 'appUpdate' });
  updateLogger.transports.file.fileName = `app-updates${is.dev ? '-dev' : ''}.log`;
  updateLogger.transports.file.level = 'debug';

  return updateLogger;
}

/* Database Logger */
export function getDatabaseLogger() {
  const databaseLogger = logger.create({ logId: 'Database' });
  databaseLogger.transports.file.fileName = `database${is.dev ? '-dev' : ''}.log`;
  databaseLogger.transports.file.level = 'debug';

  return databaseLogger;
}
