import { Page } from '@playwright/test';
import { TransactionEnvironmentConfig } from '../../services/TransactionEnvironmentConfig.js';
import { TransactionEnvironmentService } from '../../services/TransactionEnvironmentService.js';
import { ENVIRONMENT_ENV_VAR } from '../../constants/index.js';

const defaultTransactionEnvironmentConfig = new TransactionEnvironmentConfig();

export function getPrivateKeyEnv(): string | null {
  return defaultTransactionEnvironmentConfig.getPrivateKey();
}

export function getOperatorKeyEnv(): string {
  return defaultTransactionEnvironmentConfig.getOperatorKey();
}

export function getNetworkEnv(): string {
  return defaultTransactionEnvironmentConfig.getNetwork();
}

export function isLocalnetEnvironment(environment = getNetworkEnv()): boolean {
  return new TransactionEnvironmentConfig({ [ENVIRONMENT_ENV_VAR]: environment }).isLocalnet();
}

export async function setupEnvironmentForTransactions(
  window: Page,
  privateKey = getPrivateKeyEnv(),
) {
  return new TransactionEnvironmentService(window, {
    config: defaultTransactionEnvironmentConfig,
  }).setupEnvironmentForTransactions(privateKey);
}
