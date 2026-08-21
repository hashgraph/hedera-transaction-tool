import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AttestationSignatureDto } from './attestation-signature.dto';
import { CreateReviewerGroupDto, GroupMemberInputDto } from './create-reviewer-group.dto';
import { CreateReviewerRuleDto } from './create-reviewer-rule.dto';
import { DeleteReviewerGroupDto } from './delete-reviewer-group.dto';
import { DeleteReviewerRuleDto } from './delete-reviewer-rule.dto';
import { ReviewerGroupDetailDto } from './reviewer-group-detail.dto';
import { ReviewerGroupMemberDto } from './reviewer-group-member.dto';
import { ReviewerRuleDto } from './reviewer-rule.dto';
import { UpdateReviewerGroupDto } from './update-reviewer-group.dto';

describe('DTO @Transform and @Type', () => {
  describe('0x prefix stripping', () => {
    it('strips 0x from CreateReviewerGroupDto.userSignature', () => {
      const dto = plainToInstance(CreateReviewerGroupDto, { userSignature: '0xabcd' });
      expect(dto.userSignature).toBe('abcd');
    });

    it('strips 0x from CreateReviewerRuleDto.userSignature', () => {
      const dto = plainToInstance(CreateReviewerRuleDto, { userSignature: '0xabcd' });
      expect(dto.userSignature).toBe('abcd');
    });

    it('strips 0x from UpdateReviewerGroupDto.userSignature', () => {
      const dto = plainToInstance(UpdateReviewerGroupDto, { userSignature: '0xabcd' });
      expect(dto.userSignature).toBe('abcd');
    });

    it('strips 0x from DeleteReviewerGroupDto.userSignature', () => {
      const dto = plainToInstance(DeleteReviewerGroupDto, { userSignature: '0xabcd' });
      expect(dto.userSignature).toBe('abcd');
    });

    it('strips 0x from DeleteReviewerRuleDto.userSignature', () => {
      const dto = plainToInstance(DeleteReviewerRuleDto, { userSignature: '0xabcd' });
      expect(dto.userSignature).toBe('abcd');
    });

    it('strips 0x from AttestationSignatureDto.signature', () => {
      const dto = plainToInstance(AttestationSignatureDto, { signature: '0xabcd' });
      expect(dto.signature).toBe('abcd');
    });
  });

  describe('@Type factories', () => {
    it('instantiates GroupMemberInputDto for CreateReviewerGroupDto.members', () => {
      const dto = plainToInstance(CreateReviewerGroupDto, {
        members: [{ userId: 10, userKeyId: 20 }],
      });
      expect(dto.members[0]).toBeInstanceOf(GroupMemberInputDto);
    });

    it('instantiates GroupMemberInputDto for UpdateReviewerGroupDto.members', () => {
      const dto = plainToInstance(UpdateReviewerGroupDto, {
        members: [{ userId: 10, userKeyId: 20 }],
      });
      expect(dto.members[0]).toBeInstanceOf(GroupMemberInputDto);
    });

    it('instantiates nested member and rule DTOs for ReviewerGroupDetailDto', () => {
      const dto = plainToInstance(
        ReviewerGroupDetailDto,
        {
          id: 1,
          name: 'Test',
          description: null,
          threshold: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          members: [{ id: 1, groupId: 1, userId: 10, userKeyId: 20, createdAt: new Date().toISOString() }],
          rules: [{ id: 1, groupId: 1, hederaEntityId: '0.0.1234', network: 'testnet', entityRole: null, transactionType: null, createdAt: new Date().toISOString() }],
        },
        { excludeExtraneousValues: true },
      );
      expect(dto.members[0]).toBeInstanceOf(ReviewerGroupMemberDto);
      expect(dto.rules[0]).toBeInstanceOf(ReviewerRuleDto);
    });
  });

  describe('@MustBeAbsent validator', () => {
    it('fails validation when condition is provided on CreateReviewerRuleDto', async () => {
      const dto = plainToInstance(CreateReviewerRuleDto, {
        groupId: 1,
        hederaEntityId: '0.0.1234',
        network: 'testnet',
        userKeyId: 1,
        condition: 'reserved',
      });
      const errors = await validate(dto as any);
      expect(errors.some(e => e.property === 'condition')).toBe(true);
    });
  });
});
