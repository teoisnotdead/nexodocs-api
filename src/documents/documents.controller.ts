import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { DocumentsService } from './documents.service';
import { MockUploadDocumentDto } from './dto/mock-upload-document.dto';
import { UpdateDocumentStatusDto } from './dto/update-document-status.dto';

const fileUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

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

  @Post('upload')
  @UseInterceptors(fileUploadInterceptor)
  upload(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('notes') notes?: string,
  ) {
    return this.documentsService.upload(
      request.user!.organizationId,
      request.user!.userId,
      id,
      file,
      notes,
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

  @Get(':id/download')
  createDownloadUrl(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.documentsService.createDownloadUrl(
      request.user!.organizationId,
      id,
    );
  }
}
