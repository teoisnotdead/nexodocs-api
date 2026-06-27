import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  getCurrentOrganization(@Req() request: AuthenticatedRequest) {
    return this.organizationsService.getCurrentOrganization(
      request.user!.organizationId,
    );
  }
}
