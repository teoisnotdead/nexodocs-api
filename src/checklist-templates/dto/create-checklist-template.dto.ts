import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

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

export class CreateChecklistTemplateItemDto {
  @Transform(optionalText)
  @IsString()
  @MinLength(2)
  title!: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateChecklistTemplateDto {
  @Transform(optionalText)
  @IsString()
  @MinLength(2)
  name!: string;

  @Transform(optionalText)
  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistTemplateItemDto)
  items!: CreateChecklistTemplateItemDto[];
}
