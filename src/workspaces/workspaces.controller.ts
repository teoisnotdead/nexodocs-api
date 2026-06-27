import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { WorkspaceStatus } from '@prisma/client';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: WorkspaceStatus,
    @Query('search') search?: string,
  ) {
    return this.workspacesService.list(request.user!.organizationId, {
      status,
      search,
    });
  }

  @Get('stats')
  stats(@Req() request: AuthenticatedRequest) {
    return this.workspacesService.stats(request.user!.organizationId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(
      request.user!.organizationId,
      request.user!.userId,
      dto,
    );
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.get(request.user!.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(
      request.user!.organizationId,
      request.user!.userId,
      id,
      dto,
    );
  }

  @Delete(':id')
  archive(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.workspacesService.archive(
      request.user!.organizationId,
      request.user!.userId,
      id,
    );
  }
}

@Controller('clients/:clientId/workspaces')
export class ClientWorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  listByClient(
    @Req() request: AuthenticatedRequest,
    @Param('clientId') clientId: string,
  ) {
    return this.workspacesService.listByClient(
      request.user!.organizationId,
      clientId,
    );
  }
}
