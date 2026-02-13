import { EntityManager, EntityMetadata, Repository } from 'typeorm';
import {
  SqlBuilderService,
  SqlBuilderError,
  EntityNotFoundError,
  ColumnNotFoundError,
  InvalidEntityManagerError,
} from './sql-builder.service';

// Mock entities for testing
class User {
  id!: number;
  email!: string;
  firstName!: string;
  lastName!: string;
}

class Post {
  id!: number;
  title!: string;
  content!: string;
}

describe('SqlBuilder', () => {
  let entityManager: EntityManager;
  let sqlBuilder: SqlBuilderService;
  let mockMetadata: Partial<EntityMetadata>;
  let mockRepository: Partial<Repository<any>>;
  let mockEmailColumn: any;
  let mockFirstNameColumn: any;

  beforeEach(() => {
    // Create mock columns
    mockEmailColumn = {
      databaseName: 'user_email',
      propertyName: 'email',
    };

    mockFirstNameColumn = {
      databaseName: 'first_name',
      propertyName: 'firstName',
    };

    // Create mock metadata
    mockMetadata = {
      tableName: 'users',
      findColumnWithPropertyName: jest.fn((property: string) => {
        if (property === 'email') return mockEmailColumn;
        if (property === 'firstName') return mockFirstNameColumn;
        return undefined;
      }),
    };

    // Create mock repository with metadata
    mockRepository = {
      metadata: mockMetadata as EntityMetadata,
    };

    // Create mock EntityManager
    entityManager = {
      getRepository: jest.fn((entity: any) => {
        if (entity === User) return mockRepository as Repository<any>;
        throw new Error('Entity not found');
      }),
    } as unknown as EntityManager;

    sqlBuilder = new SqlBuilderService(entityManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with valid EntityManager', () => {
      expect(sqlBuilder).toBeInstanceOf(SqlBuilderService);
    });

    it('should throw InvalidEntityManagerError when EntityManager is null', () => {
      expect(() => new SqlBuilderService(null as any)).toThrow(InvalidEntityManagerError);
    });

    it('should throw InvalidEntityManagerError when EntityManager is undefined', () => {
      expect(() => new SqlBuilderService(undefined as any)).toThrow(InvalidEntityManagerError);
    });

    it('should have descriptive error message for invalid EntityManager', () => {
      expect(() => new SqlBuilderService(null as any)).toThrow(
        'EntityManager is required and must be initialized'
      );
    });
  });

  describe('table()', () => {
    it('should return table name for valid entity', () => {
      const tableName = sqlBuilder.table(User);
      expect(tableName).toBe('"users"');
    });

    it('should call getRepository with correct entity', () => {
      sqlBuilder.table(User);
      expect(entityManager.getRepository).toHaveBeenCalledWith(User);
    });

    it('should cache metadata after first call', () => {
      sqlBuilder.table(User);
      sqlBuilder.table(User);
      sqlBuilder.table(User);

      expect(entityManager.getRepository).toHaveBeenCalledTimes(1);
    });

    it('should throw EntityNotFoundError for unregistered entity', () => {
      expect(() => sqlBuilder.table(Post)).toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with entity name', () => {
      expect(() => sqlBuilder.table(Post)).toThrow('Entity "Post" not found');
    });

    it('should throw SqlBuilderError when entity is null', () => {
      expect(() => sqlBuilder.table(null)).toThrow(SqlBuilderError);
      expect(() => sqlBuilder.table(null)).toThrow('Entity cannot be null or undefined');
    });

    it('should throw SqlBuilderError when entity is undefined', () => {
      expect(() => sqlBuilder.table(undefined)).toThrow(SqlBuilderError);
    });

    it('should throw SqlBuilderError when tableName is missing', () => {
      mockMetadata.tableName = '';
      expect(() => sqlBuilder.table(User)).toThrow(SqlBuilderError);
      expect(() => sqlBuilder.table(User)).toThrow('Entity has no table name defined');
    });

    it('should throw EntityNotFoundError when repository has no metadata', () => {
      (mockRepository as any).metadata = null;
      expect(() => sqlBuilder.table(User)).toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError when repository has undefined metadata', () => {
      (mockRepository as any).metadata = undefined;
      expect(() => sqlBuilder.table(User)).toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError when getRepository returns null', () => {
      (entityManager.getRepository as jest.Mock).mockReturnValue(null);
      expect(() => sqlBuilder.table(User)).toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError when getRepository returns undefined', () => {
      (entityManager.getRepository as jest.Mock).mockReturnValue(undefined);
      expect(() => sqlBuilder.table(User)).toThrow(EntityNotFoundError);
    });
  });

  describe('col()', () => {
    it('should return column name for valid property', () => {
      const columnName = sqlBuilder.col(User, 'email');
      expect(columnName).toBe('"user_email"');
    });

    it('should call findColumnWithPropertyName with correct property', () => {
      sqlBuilder.col(User, 'email');
      expect(mockMetadata.findColumnWithPropertyName).toHaveBeenCalledWith('email');
    });

    it('should work with different properties', () => {
      const col1 = sqlBuilder.col(User, 'email');
      const col2 = sqlBuilder.col(User, 'firstName');

      expect(col1).toBe('"user_email"');
      expect(col2).toBe('"first_name"');
    });

    it('should throw ColumnNotFoundError for non-existent property', () => {
      expect(() => sqlBuilder.col(User, 'nonExistent')).toThrow(ColumnNotFoundError);
    });

    it('should throw ColumnNotFoundError with property and entity name', () => {
      expect(() => sqlBuilder.col(User, 'nonExistent')).toThrow(
        'Property "nonExistent" not found in entity "User"'
      );
    });

    it('should throw SqlBuilderError when property is empty string', () => {
      expect(() => sqlBuilder.col(User, '')).toThrow(SqlBuilderError);
      expect(() => sqlBuilder.col(User, '')).toThrow('Property name must be a non-empty string');
    });

    it('should throw SqlBuilderError when property is null', () => {
      expect(() => sqlBuilder.col(User, null as any)).toThrow(SqlBuilderError);
    });

    it('should throw SqlBuilderError when property is undefined', () => {
      expect(() => sqlBuilder.col(User, undefined as any)).toThrow(SqlBuilderError);
    });

    it('should throw SqlBuilderError when property is not a string', () => {
      expect(() => sqlBuilder.col(User, 123 as any)).toThrow(SqlBuilderError);
    });

    it('should throw EntityNotFoundError when entity is not registered', () => {
      expect(() => sqlBuilder.col(Post, 'title')).toThrow(EntityNotFoundError);
    });

    it('should throw SqlBuilderError when column has no databaseName', () => {
      mockEmailColumn.databaseName = '';
      expect(() => sqlBuilder.col(User, 'email')).toThrow(SqlBuilderError);
      expect(() => sqlBuilder.col(User, 'email')).toThrow(
        'Column for property "email" has no database name'
      );
    });

    it('should cache metadata for col() calls', () => {
      sqlBuilder.col(User, 'email');
      sqlBuilder.col(User, 'firstName');

      expect(entityManager.getRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Types', () => {
    it('should have correct error inheritance hierarchy', () => {
      const entityError = new EntityNotFoundError(User);
      const columnError = new ColumnNotFoundError(User, 'email');
      const emError = new InvalidEntityManagerError();
      const builderError = new SqlBuilderError('test');

      expect(entityError).toBeInstanceOf(SqlBuilderError);
      expect(entityError).toBeInstanceOf(Error);
      expect(columnError).toBeInstanceOf(SqlBuilderError);
      expect(emError).toBeInstanceOf(SqlBuilderError);
      expect(builderError).toBeInstanceOf(Error);
    });

    it('should have correct error names', () => {
      expect(new EntityNotFoundError(User).name).toBe('EntityNotFoundError');
      expect(new ColumnNotFoundError(User, 'email').name).toBe('ColumnNotFoundError');
      expect(new InvalidEntityManagerError().name).toBe('InvalidEntityManagerError');
      expect(new SqlBuilderError('test').name).toBe('SqlBuilderError');
    });
  });

  describe('Integration Tests', () => {
    it('should handle typical workflow: get table and column', () => {
      const table = sqlBuilder.table(User);
      const column = sqlBuilder.col(User, 'email');
      expect(`SELECT ${column} FROM ${table}`).toBe('SELECT "user_email" FROM "users"');
    });

    it('should handle mixed valid and invalid operations gracefully', () => {
      expect(sqlBuilder.table(User)).toBe('"users"');
      expect(sqlBuilder.col(User, 'email')).toBe('"user_email"');

      expect(() => sqlBuilder.table(Post)).toThrow(EntityNotFoundError);
      expect(() => sqlBuilder.col(User, 'invalid')).toThrow(ColumnNotFoundError);

      expect(sqlBuilder.table(User)).toBe('"users"');
      expect(sqlBuilder.col(User, 'email')).toBe('"user_email"');
    });

    it('should generate valid SQL query parts', () => {
      const table = sqlBuilder.table(User);
      const emailCol = sqlBuilder.col(User, 'email');
      const firstNameCol = sqlBuilder.col(User, 'firstName');

      const query = `SELECT ${emailCol}, ${firstNameCol} FROM ${table} WHERE ${emailCol} = ?`;

      expect(query).toBe('SELECT "user_email", "first_name" FROM "users" WHERE "user_email" = ?');
    });
  });

  describe('Performance and Caching', () => {
    it('should cache across table() and col() calls for same entity', () => {
      sqlBuilder.table(User);
      sqlBuilder.col(User, 'email');
      sqlBuilder.col(User, 'firstName');
      sqlBuilder.table(User);

      expect(entityManager.getRepository).toHaveBeenCalledTimes(1);
    });

    it('should not cache failed entity lookups', () => {
      try { sqlBuilder.table(Post); } catch { /* empty */ }
      try { sqlBuilder.table(Post); } catch { /* empty */ }

      expect(entityManager.getRepository).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string table name', () => {
      mockMetadata.tableName = '';
      expect(() => sqlBuilder.table(User)).toThrow('Entity has no table name defined');
    });

    it('should handle whitespace-only property names', () => {
      expect(() => sqlBuilder.col(User, '   ')).toThrow(SqlBuilderError);
    });

    it('should handle numeric property parameter', () => {
      expect(() => sqlBuilder.col(User, 42 as any)).toThrow('Property name must be a non-empty string');
    });

    it('should handle object as property parameter', () => {
      expect(() => sqlBuilder.col(User, {} as any)).toThrow('Property name must be a non-empty string');
    });

    it('should handle array as entity parameter', () => {
      expect(() => sqlBuilder.table([] as any)).toThrow(EntityNotFoundError);
    });

    it('should handle entity with undefined tableName property', () => {
      mockMetadata.tableName = undefined as any;
      expect(() => sqlBuilder.table(User)).toThrow(SqlBuilderError);
    });

    it('should handle column with null databaseName', () => {
      mockEmailColumn.databaseName = null;
      expect(() => sqlBuilder.col(User, 'email')).toThrow(SqlBuilderError);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle multiple entities being cached', () => {
      const mockPostMetadata = {
        tableName: 'posts',
        findColumnWithPropertyName: jest.fn(),
      };

      const mockPostRepository = {
        metadata: mockPostMetadata as unknown as EntityMetadata,
      };

      (entityManager.getRepository as jest.Mock).mockImplementation((entity: any) => {
        if (entity === User) return mockRepository as Repository<any>;
        if (entity === Post) return mockPostRepository as Repository<any>;
        throw new Error('Entity not found');
      });

      sqlBuilder.table(User);
      sqlBuilder.table(Post);
      sqlBuilder.table(User);
      sqlBuilder.table(Post);

      expect(entityManager.getRepository).toHaveBeenCalledTimes(2);
      expect(entityManager.getRepository).toHaveBeenCalledWith(User);
      expect(entityManager.getRepository).toHaveBeenCalledWith(Post);
    });

    it('should maintain separate cache entries for different entities', () => {
      const mockPostMetadata = {
        tableName: 'posts',
        findColumnWithPropertyName: jest.fn(),
      };

      const mockPostRepository = {
        metadata: mockPostMetadata as unknown as EntityMetadata,
      };

      (entityManager.getRepository as jest.Mock).mockImplementation((entity: any) => {
        if (entity === User) return mockRepository as Repository<any>;
        if (entity === Post) return mockPostRepository as Repository<any>;
        throw new Error('Entity not found');
      });

      expect(sqlBuilder.table(User)).toBe('"users"');
      expect(sqlBuilder.table(Post)).toBe('"posts"');

      // Both should still be cached
      sqlBuilder.table(User);
      sqlBuilder.table(Post);
      expect(entityManager.getRepository).toHaveBeenCalledTimes(2);
    });
  });

  describe('Repository Edge Cases', () => {
    it('should handle repository with metadata property that is not an object', () => {
      (mockRepository as any).metadata = 'not-an-object';
      expect(() => sqlBuilder.table(User)).toThrow(SqlBuilderError);
    });

    it('should handle repository without metadata property', () => {
      delete (mockRepository as any).metadata;
      expect(() => sqlBuilder.table(User)).toThrow(EntityNotFoundError);
    });

    it('should handle getRepository throwing an error', () => {
      (entityManager.getRepository as jest.Mock).mockImplementation(() => {
        throw new Error('Repository creation failed');
      });

      expect(() => sqlBuilder.table(User)).toThrow(EntityNotFoundError);
    });
  });

  describe('Metadata Access', () => {
    it('should access metadata via repository.metadata', () => {
      sqlBuilder.table(User);

      const repository = (entityManager.getRepository as jest.Mock).mock.results[0].value;
      expect(repository).toBe(mockRepository);
      expect(repository.metadata).toBe(mockMetadata);
    });

    it('should call findColumnWithPropertyName on metadata', () => {
      sqlBuilder.col(User, 'email');

      expect(mockMetadata.findColumnWithPropertyName).toHaveBeenCalledWith('email');
      expect(mockMetadata.findColumnWithPropertyName).toHaveBeenCalledTimes(1);
    });

    it('should handle metadata with missing findColumnWithPropertyName method', () => {
      delete (mockMetadata as any).findColumnWithPropertyName;

      expect(() => sqlBuilder.col(User, 'email')).toThrow();
    });
  });
});