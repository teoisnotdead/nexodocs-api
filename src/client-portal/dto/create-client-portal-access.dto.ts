import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateClientPortalAccessDto {
  @IsOptional()
  @IsString()
  clientContactId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;
}
