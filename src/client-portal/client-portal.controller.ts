import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { MAX_UPLOAD_FILE_SIZE_BYTES } from '../common/constants/file-upload';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ClientPortalService } from './client-portal.service';
import { CreateClientPortalAccessDto } from './dto/create-client-portal-access.dto';
import { VerifyClientPortalCodeDto } from './dto/verify-client-portal-code.dto';

const fileUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
});

@Controller('workspaces/:workspaceId/client-portal-access')
export class WorkspaceClientPortalAccessController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateClientPortalAccessDto,
  ) {
    return this.clientPortalService.createAccess(
      request.user!.organizationId,
      request.user!.userId,
      workspaceId,
      dto,
    );
  }
}

@Controller('client-portal/access/:token')
export class ClientPortalController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  @Public()
  @Get()
  inspect(@Param('token') token: string) {
    return this.clientPortalService.inspectAccess(token);
  }

  @Public()
  @Post('verify')
  verify(@Param('token') token: string, @Body() dto: VerifyClientPortalCodeDto) {
    return this.clientPortalService.verifyCode(token, dto);
  }

  @Public()
  @Get('document-requests')
  listDocumentRequests(
    @Req() request: Request,
    @Param('token') token: string,
  ) {
    return this.clientPortalService.listDocumentRequests(
      token,
      extractBearerToken(request),
    );
  }

  @Public()
  @Post('document-requests/:documentRequestId/upload')
  @UseInterceptors(fileUploadInterceptor)
  uploadDocument(
    @Req() request: Request,
    @Param('token') token: string,
    @Param('documentRequestId') documentRequestId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('notes') notes?: string,
  ) {
    return this.clientPortalService.uploadDocument(
      token,
      extractBearerToken(request),
      documentRequestId,
      file,
      notes,
    );
  }

  @Public()
  @Get('documents/:documentId/download')
  createDownloadUrl(
    @Req() request: Request,
    @Param('token') token: string,
    @Param('documentId') documentId: string,
  ) {
    return this.clientPortalService.createDocumentDownloadUrl(
      token,
      extractBearerToken(request),
      documentId,
    );
  }
}

function extractBearerToken(request: Request) {
  const authorization = request.headers?.['authorization'];

  if (Array.isArray(authorization)) {
    return authorization[0]?.startsWith('Bearer ')
      ? authorization[0].slice(7)
      : null;
  }

  return authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;
}
