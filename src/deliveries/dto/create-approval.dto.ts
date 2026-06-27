import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';

const optionalText = ({ value }: { value: unknown }) => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class CreateApprovalDto {
  @IsEnum(ApprovalStatus)
  status!: ApprovalStatus;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  comment?: string;
}
