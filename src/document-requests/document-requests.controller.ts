import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { UpdateDocumentRequestStatusDto } from './dto/update-document-request-status.dto';
import { UpdateDocumentRequestDto } from './dto/update-document-request.dto';
import { DocumentRequestsService } from './document-requests.service';

@Controller('workspaces/:workspaceId/document-requests')
export class WorkspaceDocumentRequestsController {
  constructor(
    private readonly documentRequestsService: DocumentRequestsService,
  ) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.documentRequestsService.list(
      request.user!.organizationId,
      workspaceId,
    );
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentRequestDto,
  ) {
    return this.documentRequestsService.create(
      request.user!.organizationId,
      request.user!.userId,
      workspaceId,
      dto,
    );
  }
}

@Controller('document-requests')
export class DocumentRequestsController {
  constructor(
    private readonly documentRequestsService: DocumentRequestsService,
  ) {}

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentRequestDto,
  ) {
    return this.documentRequestsService.update(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentRequestStatusDto,
  ) {
    return this.documentRequestsService.updateStatus(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }

  @Delete(':id')
  delete(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.documentRequestsService.delete(
      request.user!.organizationId,
      id,
    );
  }
}
