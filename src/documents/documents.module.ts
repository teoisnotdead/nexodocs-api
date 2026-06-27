import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  DocumentRequestDocumentsController,
  DocumentsController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [ActivityLogsModule, PrismaModule],
  controllers: [DocumentRequestDocumentsController, DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
