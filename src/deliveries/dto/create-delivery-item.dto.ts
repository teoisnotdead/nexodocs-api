import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

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

export class CreateDeliveryItemDto {
  @Transform(optionalText)
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  @MinLength(2)
  fileName?: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}
