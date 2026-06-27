import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReviewDecision } from '@prisma/client';

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

export class CreateReviewDto {
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  comment?: string;
}
