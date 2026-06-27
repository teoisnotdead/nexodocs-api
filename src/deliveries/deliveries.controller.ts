import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { CreateDeliveryItemDto } from './dto/create-delivery-item.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveriesService } from './deliveries.service';

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
