import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

const optionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class ApplyChecklistTemplateDto {
  @Transform(optionalText)
  @IsString()
  @MinLength(2)
  templateId!: string;
}
