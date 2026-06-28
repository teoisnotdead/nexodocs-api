import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

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

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  @MinLength(2)
  assignedClientContactId?: string;
}
