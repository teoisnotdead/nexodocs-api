import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { DocumentsService } from './documents.service';
import { MockUploadDocumentDto } from './dto/mock-upload-document.dto';
import { UpdateDocumentStatusDto } from './dto/update-document-status.dto';

@Controller('document-requests/:id')
export class DocumentRequestDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('documents')
  list(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.documentsService.listByRequest(
      request.user!.organizationId,
      id,
    );
  }

  @Post('mock-upload')
  mockUpload(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MockUploadDocumentDto,
  ) {
    return this.documentsService.mockUpload(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentStatusDto,
  ) {
    return this.documentsService.updateStatus(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }
}
