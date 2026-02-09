import type { IClient } from '@shared/interfaces/organization/user';

export function getLatestClient(clients: IClient[] | undefined | null): IClient | null {
  if (!clients || clients.length === 0) return null;
  return clients.reduce((latest, client) =>
    new Date(client.updatedAt) > new Date(latest.updatedAt) ? client : latest,
  );
}
