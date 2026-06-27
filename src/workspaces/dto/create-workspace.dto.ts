import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { WorkspaceStatus, WorkspaceType } from '@prisma/client';

const optionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalNumber = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return Number(value);
};

export class CreateWorkspaceDto {
  @Transform(optionalText)
  @IsString()
  clientId!: string;

  @Transform(optionalText)
  @IsString()
  @MinLength(2)
  name!: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WorkspaceType)
  workspaceType?: WorkspaceType;

  @Transform(optionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2200)
  periodYear?: number;

  @Transform(optionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @Transform(optionalText)
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(WorkspaceStatus)
  status?: WorkspaceStatus;
}
