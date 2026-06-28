import { Matches } from 'class-validator';

export class VerifyClientPortalCodeDto {
  @Matches(/^\d{6}$/)
  code!: string;
}
