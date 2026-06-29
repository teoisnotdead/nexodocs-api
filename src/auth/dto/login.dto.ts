import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
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
