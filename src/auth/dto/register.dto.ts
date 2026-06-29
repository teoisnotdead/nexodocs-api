import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
