import { Expose } from 'class-transformer';

// The only response that ever carries the full key string - returned exactly
// once, at creation or regeneration time. Never persisted or returned again.
export class ApiKeyRevealDto {
  @Expose() key!: string;
  @Expose() keyId!: string;
  @Expose() createdAt!: Date;
}
