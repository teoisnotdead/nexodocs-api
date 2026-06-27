import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ClientStatus } from '@prisma/client';
import { UpdateClientContactDto } from './client-contact.dto';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateClientDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  legalName?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  taxId?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  industry?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  phone?: string;

  @Transform(trimString)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateClientContactDto)
  primaryContact?: UpdateClientContactDto;
}
