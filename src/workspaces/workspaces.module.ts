import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PlansModule } from '../plans/plans.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ClientWorkspacesController,
  WorkspacesController,
} from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [ActivityLogsModule, PlansModule, PrismaModule],
  controllers: [WorkspacesController, ClientWorkspacesController],
  providers: [WorkspacesService],
})
export class WorkspacesModule {}
