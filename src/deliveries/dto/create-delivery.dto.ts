import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

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

export class CreateDeliveryDto {
  @Transform(optionalText)
  @IsString()
  @MinLength(2)
  title!: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  description?: string;
}
