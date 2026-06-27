import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

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

export class ResolveObservationDto {
  @Transform(optionalText)
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}
