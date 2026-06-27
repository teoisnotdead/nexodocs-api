import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  DocumentRequestsController,
  WorkspaceDocumentRequestsController,
} from './document-requests.controller';
import { DocumentRequestsService } from './document-requests.service';

@Module({
  imports: [ActivityLogsModule, PrismaModule],
  controllers: [
    WorkspaceDocumentRequestsController,
    DocumentRequestsController,
  ],
  providers: [DocumentRequestsService],
})
export class DocumentRequestsModule {}
