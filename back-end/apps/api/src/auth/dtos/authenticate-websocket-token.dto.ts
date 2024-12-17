import { IsNotEmpty, IsString } from 'class-validator';

export class AuthenticateWebsocketTokenDto {
  @IsString()
  @IsNotEmpty()
  jwt: string;
}
