import {
  DEFAULT_LOCALNET_OPERATOR_KEY,
  DEFAULT_NETWORK,
  ENVIRONMENT_ENV_VAR,
  OPERATOR_KEY_ENV_VAR,
  PRIVATE_KEY_ENV_VAR,
} from '../constants/index.js';

type EnvironmentSource = Record<string, string | undefined>;

export class TransactionEnvironmentConfig {
  constructor(private readonly env: EnvironmentSource = process.env) {}

  getPrivateKey(): string | null {
    return this.getNonEmptyValue(PRIVATE_KEY_ENV_VAR);
  }

  getOperatorKey(): string {
    return this.getNonEmptyValue(OPERATOR_KEY_ENV_VAR) ?? DEFAULT_LOCALNET_OPERATOR_KEY;
  }

  getNetwork(): string {
    return this.getNonEmptyValue(ENVIRONMENT_ENV_VAR) ?? DEFAULT_NETWORK;
  }

  getNormalizedNetwork(): string {
    return this.getNetwork().toUpperCase();
  }

  isLocalnet(): boolean {
    return this.getNormalizedNetwork() === DEFAULT_NETWORK;
  }

  getCustomMirrorNodeBaseUrl(): string {
    return this.getNetwork();
  }

  private getNonEmptyValue(key: string): string | null {
    const value = this.env[key];
    return value && value !== '' ? value : null;
  }
}
