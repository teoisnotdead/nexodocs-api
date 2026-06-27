import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ChecklistTemplatesController,
  WorkspaceChecklistTemplatesController,
} from './checklist-templates.controller';
import { ChecklistTemplatesService } from './checklist-templates.service';

@Module({
  imports: [ActivityLogsModule, PrismaModule],
  controllers: [
    ChecklistTemplatesController,
    WorkspaceChecklistTemplatesController,
  ],
  providers: [ChecklistTemplatesService],
})
export class ChecklistTemplatesModule {}
