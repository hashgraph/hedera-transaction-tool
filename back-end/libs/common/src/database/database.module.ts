import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [],
      useFactory: (configService: ConfigService) =>
        ({
          type: 'postgres',
          host: configService.getOrThrow('POSTGRES_HOST'),
          port: configService.getOrThrow<number>('POSTGRES_PORT', { infer: true }),
          database: configService.getOrThrow('POSTGRES_DATABASE'),
          username: configService.getOrThrow('POSTGRES_USERNAME'),
          password: configService.getOrThrow('POSTGRES_PASSWORD'),
          synchronize: configService.getOrThrow<boolean>('POSTGRES_SYNCHRONIZE', { infer: true }),
          autoLoadEntities: true,
          poolSize: configService.getOrThrow<number>('POSTGRES_MAX_POOL_SIZE', { infer: true }),
        }) as TypeOrmModuleAsyncOptions,
      inject: [ConfigService],
    }),

    // Cache connection pool
    TypeOrmModule.forRootAsync({
      name: 'cache', // Add name
      imports: [],
      useFactory: (configService: ConfigService) =>
        ({
          type: 'postgres',
          host: configService.getOrThrow('POSTGRES_HOST'),
          port: configService.getOrThrow<number>('POSTGRES_PORT', { infer: true }),
          database: configService.getOrThrow('POSTGRES_DATABASE'),
          username: configService.getOrThrow('POSTGRES_USERNAME'),
          password: configService.getOrThrow('POSTGRES_PASSWORD'),
          synchronize: false, // Don't sync twice
          autoLoadEntities: true,
          poolSize: 5, // Smaller dedicated pool
          extra: {
            statement_timeout: 15000, // Slightly longer for cache operations
          },
        }) as TypeOrmModuleAsyncOptions,
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {
  static forFeature(entities: EntityClassOrSchema[], connectionName?: string) {
    return TypeOrmModule.forFeature(entities, connectionName);
  }
}
