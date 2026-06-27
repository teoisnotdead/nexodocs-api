import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.summary(request.user!.organizationId);
  }
}
