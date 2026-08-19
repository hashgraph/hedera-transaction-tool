import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  GroupChangeRecord,
  ReviewerGroup,
  ReviewerGroupMember,
  ReviewerRule,
  RuleChangeRecord,
  UserKey,
} from '@entities';

import { ReviewerGroupsController } from './reviewer-groups.controller';
import { ReviewerRulesController } from './reviewer-rules.controller';
import { ReviewerGroupsService } from './reviewer-groups.service';
import { ReviewerRulesService } from './reviewer-rules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReviewerGroup,
      ReviewerGroupMember,
      ReviewerRule,
      GroupChangeRecord,
      RuleChangeRecord,
      UserKey,
    ]),
  ],
  controllers: [ReviewerGroupsController, ReviewerRulesController],
  providers: [ReviewerGroupsService, ReviewerRulesService],
  exports: [ReviewerGroupsService, ReviewerRulesService],
})
export class ReviewerGroupsModule {}
