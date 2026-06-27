import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { DocumentRequestStatus } from '@prisma/client';

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

export class UpdateDocumentRequestDto {
  @Transform(optionalText)
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @Transform(optionalText)
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  assignedClientContactId?: string | null;

  @IsOptional()
  @IsEnum(DocumentRequestStatus)
  status?: DocumentRequestStatus;
}
