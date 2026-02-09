import { EntityManager, EntityMetadata, EntityTarget } from 'typeorm';
import { Injectable } from '@nestjs/common';

export interface SqlQuery {
  text: string;
  values: any[];
}

/**
 * Custom error classes for better error handling
 */
export class SqlBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqlBuilderError';
  }
}

export class EntityNotFoundError extends SqlBuilderError {
  constructor(entity: any) {
    const entityName = typeof entity === 'function' ? entity.name : String(entity);
    super(`Entity "${entityName}" not found in EntityManager metadata. Is it registered?`);
    this.name = 'EntityNotFoundError';
  }
}

export class ColumnNotFoundError extends SqlBuilderError {
  constructor(entity: any, property: string) {
    const entityName = typeof entity === 'function' ? entity.name : String(entity);
    super(`Property "${property}" not found in entity "${entityName}". Check property name or entity definition.`);
    this.name = 'ColumnNotFoundError';
  }
}

export class InvalidEntityManagerError extends SqlBuilderError {
  constructor() {
    super('EntityManager is required and must be initialized. Provide a valid EntityManager instance.');
    this.name = 'InvalidEntityManagerError';
  }
}

/**
 * SqlBuilder - Type-safe SQL identifier builder with comprehensive error handling
 */
@Injectable()
export class SqlBuilderService {
  private metaCache = new Map<EntityTarget<any>, EntityMetadata>();

  constructor(private entityManager: EntityManager) {
    if (!entityManager) {
      throw new InvalidEntityManagerError();
    }
  }

  /**
   * Gets entity metadata with caching and error handling
   */
  private getMeta(entity: EntityTarget<any>): EntityMetadata {
    // Validate entity parameter
    if (entity === null || entity === undefined) {
      throw new SqlBuilderError('Entity cannot be null or undefined');
    }

    // Return cached metadata if available
    if (this.metaCache.has(entity)) {
      return this.metaCache.get(entity)!;
    }

    // Attempt to get metadata
    try {
      const repository = this.entityManager.getRepository(entity);
      const metadata = repository && (repository as any).metadata as EntityMetadata | undefined;

      if (!metadata) {
        throw new EntityNotFoundError(entity);
      }

      // Cache successful result
      this.metaCache.set(entity, metadata);
      return metadata;
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof SqlBuilderError) {
        throw error;
      }

      throw new EntityNotFoundError(entity);
    }
  }

  /**
   * Gets the database table name for an entity
   * @param entity - The TypeORM entity class
   * @returns The table name in the database
   * @throws {EntityNotFoundError} If entity is not registered
   */
  table(entity: EntityTarget<any>): string {
    try {
      const metadata = this.getMeta(entity);

      if (!metadata.tableName) {
        throw new SqlBuilderError(`Entity has no table name defined`);
      }

      // Handle schema-qualified table names: schema.table
      const parts = metadata.tableName.split('.');
      return parts.map(p => `"${p}"`).join('.');
    } catch (error) {
      // Add context about which method failed
      if (error instanceof SqlBuilderError) {
        throw error;
      }
      throw new SqlBuilderError(`Failed to get table name: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets the database column name for an entity property
   * @param entity - The TypeORM entity class
   * @param property - The property name on the entity
   * @returns The column name in the database
   * @throws {EntityNotFoundError} If entity is not registered
   * @throws {ColumnNotFoundError} If property doesn't exist on entity
   */
  col(entity: EntityTarget<any>, property: string): string {
    // Validate property parameter
    if (!property || typeof property !== 'string') {
      throw new SqlBuilderError('Property name must be a non-empty string');
    }

    try {
      const metadata = this.getMeta(entity);
      const column = metadata.findColumnWithPropertyName(property);

      if (!column) {
        throw new ColumnNotFoundError(entity, property);
      }

      if (!column.databaseName) {
        throw new SqlBuilderError(`Column for property "${property}" has no database name`);
      }

      return `"${column.databaseName}"`;
    } catch (error) {
      // Re-throw our custom errors with context
      if (error instanceof SqlBuilderError) {
        throw error;
      }
      throw new SqlBuilderError(`Failed to get column name for property "${property}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}