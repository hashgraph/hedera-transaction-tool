import { DataSource } from 'typeorm';

export class SqlBuilder {
  private metaCache = new Map();

  constructor(private dataSource: DataSource) {}

  private getMeta(entity: any) {
    if (!this.metaCache.has(entity)) {
      this.metaCache.set(entity, this.dataSource.getMetadata(entity));
    }
    return this.metaCache.get(entity);
  }

  table(entity: any): string {
    return this.getMeta(entity).tableName;
  }

  col(entity: any, property: string): string {
    return this.getMeta(entity).findColumnWithPropertyName(property).databaseName;
  }
}