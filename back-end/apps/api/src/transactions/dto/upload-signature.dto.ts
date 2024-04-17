import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSignatureMap } from '@app/common';

export class UploadSignatureDto {
  @IsNumber()
  publicKeyId: number;

  @ApiProperty({
    type: 'object',
    example: {
      '0.0.3':
        '0xac244c7240650eaa32b60fd4d7d2ef9f49d3bcd1e3ae1df273ede1b4da32f32b25e389d5a8195b6efbc39ac62810348688976c5304fbef33e51cd7505592cd0f',
      '0.0.5':
        '0x053bc5e784dc767095fbdafaaefed3553dd384b86877276951c7eb634d1f0191288a2cc72e6477a1661a483a38935ab51297ec84555c1d0bcb68daf77fb49a0b',
      '0.0.7':
        '0xccad395302df6b0ea31d15d9ab9c58bc5a6dc6ec9a334dbfb09c321e6fba802bf8873ba03e3e81d80e499d56a318f663d897aff78cedeb1b7a3d43bdf4609a08',
    },
  })
  @IsSignatureMap()
  signatures: { [key: string]: Buffer };
}
