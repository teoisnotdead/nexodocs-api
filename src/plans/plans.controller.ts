import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  list() {
    return this.plansService.listPlans();
  }

  @Get('current')
  current(@Req() request: AuthenticatedRequest) {
    return this.plansService.current(request.user!.organizationId);
  }
}
