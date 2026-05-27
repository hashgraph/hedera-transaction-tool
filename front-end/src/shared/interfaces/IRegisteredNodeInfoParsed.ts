import type { Key, RegisteredServiceEndpoint } from '@hiero-ledger/sdk';
import type { TimestampRange } from './HederaSchema';

export interface IRegisteredNodeInfoParsed {
  admin_key: Key | null;
  created_timestamp: string | null;
  description: string | null;
  registered_node_id: number;
  service_endpoints: RegisteredServiceEndpoint[];
  timestamp: TimestampRange;
}
