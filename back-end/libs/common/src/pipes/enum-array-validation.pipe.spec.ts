import { TransactionId } from '@hashgraph/sdk';

import { TransactionIdPipe } from '@app/common/pipes/transaction-id.pipe';
import { EnumArrayValidationPipe } from '@app/common/pipes/enum-array-validation.pipe';

describe('EnumArrayValidationPipe', () => {
  enum SampleEnum {
    ONE = 'one',
    TWO = 'two',
    THREE = 'three',
  }

  const pipe = new EnumArrayValidationPipe<SampleEnum>(SampleEnum);

  it('should transform empty string to []', () => {
    expect(pipe.transform('')).toStrictEqual([]);
  });

  it('should transform valid string to enums', async () => {
    expect(pipe.transform('one,two')).toStrictEqual([SampleEnum.ONE, SampleEnum.TWO]);
    expect(pipe.transform('three,two,one')).toStrictEqual([
      SampleEnum.ONE,
      SampleEnum.THREE,
      SampleEnum.TWO,
    ]);
  });

  it('should reject invalid string', async () => {
    expect(() => pipe.transform('invalid')).toThrow();
    expect(() => pipe.transform('one,invalid')).toThrow();
  });
});
