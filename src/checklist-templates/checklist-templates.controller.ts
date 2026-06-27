import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ChecklistTemplatesService } from './checklist-templates.service';
import { ApplyChecklistTemplateDto } from './dto/apply-checklist-template.dto';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';

@Controller('checklist-templates')
export class ChecklistTemplatesController {
  constructor(
    private readonly checklistTemplatesService: ChecklistTemplatesService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.checklistTemplatesService.list(request.user!.organizationId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateChecklistTemplateDto,
  ) {
    return this.checklistTemplatesService.create(
      request.user!.organizationId,
      request.user!.userId,
      dto,
    );
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.checklistTemplatesService.get(
      request.user!.organizationId,
      id,
    );
  }
}

@Controller('workspaces/:workspaceId')
export class WorkspaceChecklistTemplatesController {
  constructor(
    private readonly checklistTemplatesService: ChecklistTemplatesService,
  ) {}

  @Post('apply-template')
  applyTemplate(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ApplyChecklistTemplateDto,
  ) {
    return this.checklistTemplatesService.applyToWorkspace(
      request.user!.organizationId,
      request.user!.userId,
      workspaceId,
      dto,
    );
  }
}
