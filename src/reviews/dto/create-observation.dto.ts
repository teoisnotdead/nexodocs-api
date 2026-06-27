import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

const trimmedText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

export class CreateObservationDto {
  @Transform(trimmedText)
  @IsString()
  @MinLength(3)
  comment!: string;
}
