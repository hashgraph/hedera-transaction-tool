import { SqlBuilderService } from '@app/common';
import { EntityTarget } from 'typeorm';

export function getUpsertRefreshTokenForCacheQuery(
  sql: SqlBuilderService,
  entity: EntityTarget<any>,
  keyColumns: string[],
): string {
  const tableName = sql.table(entity);

  const keyColumnNames = keyColumns.map(col => sql.col(entity, col));
  const createdAtCol = sql.col(entity, 'createdAt');
  const updatedAtCol = sql.col(entity, 'updatedAt');
  const refreshTokenCol = sql.col(entity, 'refreshToken');

  const insertColumns = [
    ...keyColumnNames,
    createdAtCol,
    updatedAtCol,
    refreshTokenCol,
  ];

  const numKeys = keyColumns.length;
  const keyParams = keyColumns.map((_, i) => `$${i + 1}`);
  const refreshTokenParam = `$${numKeys + 1}`;
  const reclaimDateParam = `$${numKeys + 2}`;

  const valuePlaceholders = keyParams
    .concat([
      'NOW()',
      'NOW()',
      refreshTokenParam,
    ]);

  const keyWhereClause = keyColumnNames
    .map((col, i) => `${col} = ${keyParams[i]}`)
    .join(' AND ');

  return `
    WITH claimed AS (
      INSERT INTO ${tableName} (${insertColumns.join(', ')})
      VALUES (${valuePlaceholders.join(', ')})
      ON CONFLICT (${keyColumnNames.join(', ')})
      DO UPDATE SET
        ${refreshTokenCol} = EXCLUDED.${refreshTokenCol},
        ${updatedAtCol} = NOW()
      WHERE ${tableName}.${refreshTokenCol} IS NULL
         OR ${tableName}.${updatedAtCol} < ${reclaimDateParam}
      RETURNING *
    )
    SELECT * FROM claimed
             
    UNION ALL
    
    SELECT *
    FROM ${tableName}
    WHERE ${keyWhereClause}
      AND NOT EXISTS (SELECT 1 FROM claimed)
      
    LIMIT 1
  `.trim();
}
