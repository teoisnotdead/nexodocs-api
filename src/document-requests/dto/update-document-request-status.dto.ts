import { IsEnum } from 'class-validator';
import { DocumentRequestStatus } from '@prisma/client';

export class UpdateDocumentRequestStatusDto {
  @IsEnum(DocumentRequestStatus)
  status!: DocumentRequestStatus;
}
