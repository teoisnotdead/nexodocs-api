import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateClientContactDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  name!: string;

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
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateClientContactDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

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
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
