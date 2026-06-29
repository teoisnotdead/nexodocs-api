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
import { MAX_UPLOAD_FILE_SIZE_BYTES } from '../common/constants/file-upload';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { CreateDeliveryItemDto } from './dto/create-delivery-item.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveriesService } from './deliveries.service';

const fileUploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
});

@Controller('workspaces/:workspaceId/deliveries')
export class WorkspaceDeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.deliveriesService.list(
      request.user!.organizationId,
      workspaceId,
    );
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDeliveryDto,
  ) {
    return this.deliveriesService.create(
      request.user!.organizationId,
      request.user!.userId,
      workspaceId,
      dto,
    );
  }
}

@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Patch(':id/status')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveriesService.updateStatus(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }

  @Post(':id/items')
  addItem(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateDeliveryItemDto,
  ) {
    return this.deliveriesService.addItem(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }

  @Post(':id/items/upload')
  @UseInterceptors(fileUploadInterceptor)
  uploadItem(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('description') description?: string,
  ) {
    return this.deliveriesService.uploadItem(
      request.user!.organizationId,
      request.user!.userId,
      id,
      file,
      { title, description },
    );
  }

  @Get('items/:itemId/download')
  createItemDownloadUrl(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    return this.deliveriesService.createItemDownloadUrl(
      request.user!.organizationId,
      itemId,
    );
  }

  @Post(':id/approval')
  createApproval(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.deliveriesService.createApproval(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }
}
