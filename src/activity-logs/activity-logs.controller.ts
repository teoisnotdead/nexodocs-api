import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ActivityLogsService } from './activity-logs.service';

@Controller('workspaces/:workspaceId/activity')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  listByWorkspace(
    @Req() request: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.activityLogsService.listByWorkspace(
      request.user!.organizationId,
      workspaceId,
      { limit, offset },
    );
  }
}
