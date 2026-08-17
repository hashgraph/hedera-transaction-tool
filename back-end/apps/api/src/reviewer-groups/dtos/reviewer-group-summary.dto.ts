import { Expose } from 'class-transformer';

export class ReviewerGroupSummaryDto {
  @Expose() id: number;
  @Expose() name: string;
  @Expose() description: string | null;
  @Expose() threshold: number;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
