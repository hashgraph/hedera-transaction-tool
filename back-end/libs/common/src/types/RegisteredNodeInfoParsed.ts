import type { Key, RegisteredServiceEndpoint } from '@hiero-ledger/sdk';
import { TimestampRange } from '../schemas';

export interface RegisteredNodeInfoParsed {
  admin_key: Key | null;
  created_timestamp: string | null;
  description: string | null;
  registered_node_id: number;
  service_endpoints: RegisteredServiceEndpoint[];
  timestamp: TimestampRange;
}
